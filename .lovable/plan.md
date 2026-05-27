
# ממלכת הזיכרון של כרמן — תוכנית v2 (מעודכנת לפי SOTA 2025)

## הערכת התוכנית המקורית

✅ **מה היה נכון**:
- היררכיה של תיקיות (תואם MemGPT/Letta Memory Blocks)
- Pointers במקום copies (תואם TierMem, Graphiti episode nodes)
- טריגרים לעדכון אוטומטי (תואם CDC patterns)
- אינדקס נפרד מהדאטה (תואם Two-tier memory)

⚠️ **מה היה חסר** (מהמחקר):
1. **חלוקה ל-4 סוגי זיכרון** (working / episodic / semantic / procedural) — לא רק "תיקיות"
2. **Outbox pattern** במקום טריגרים ישירים — טריגרים שמשנים טבלאות אחרות שבירים ולא ניתנים ל-retry
3. **Bi-temporal edges** — ידיעה ש"לקוח X שייך לקמפיינר Y" צריכה `valid_from`/`valid_until`, כי שיוכים משתנים. בלי זה הזיכרון יספר לכרמן שדקל מטפל בלקוח שעבר אליה לפני חודש.
4. **pgvector** לחיפוש סמנטי על summaries (לא רק path-based lookup)
5. **Sufficiency router** ברגע הקריאה — האם ה-summary מספיק או לקפוץ ל-Postgres לרשומה החיה
6. **Decay** ל-episodic בלבד, לעולם לא ל-pointers
7. **Importance scoring** בזמן כתיבה — לא כל הודעה נכנסת לזיכרון

---

## 1. מודל הנתונים — 3 טבלאות (לא אחת)

### א. `carmen_memory_pointers` — שלד היררכי (semantic memory)
האינדקס שמדבר על entities. כל שורה היא **קישור** לרשומה אמיתית, לא העתק.

```
tenant_id, category, subcategory, path,
entity_type, entity_id,           -- מצביע לטבלה המקורית
title, summary,                    -- summary קצר ל-discovery בלבד
summary_embedding vector(1536),    -- pgvector לחיפוש סמנטי
ref_date, valid_from, valid_until, -- bi-temporal (Graphiti-style)
importance smallint,               -- 0-100, נקבע ע"י LLM בזמן הכתיבה
metadata jsonb, created_at, updated_at
```

עץ ה-paths:
```
clients/<id>/{reports,updates,communications}
team/<id>/{tasks,communications,assigned_clients}
messages/<YYYY-MM-DD>/<channel>      ← אינדקס אפיזודי לפי תאריך
conversations/<topic>/<YYYY-MM>       ← שיחות AIOS קודמות
system_map/<module>                   ← מפת מערכת לכרמן
```

### ב. `carmen_memory_episodes` — סיכומי שיחות (episodic memory)
לא לכל הודעה — רק לסשנים שהסתיימו. כאן יושב הסיכום הסמנטי, עם pointer לrange של הודעות מקוריות.

```
tenant_id, session_ref, summary, summary_embedding,
source_message_ids uuid[],   -- pointers לhódעות המקוריות
participants, topic_tags, importance, retention_score,
created_at, last_accessed_at
```

`retention_score` מתעדכן בעבודת רקע יומית: `importance × exp(-λ·days) × access_boost`. כשהוא יורד מתחת לסף — מוחקים את הסיכום (ההודעות המקוריות נשארות ב-`chat_messages`!).

### ג. `carmen_memory_outbox` — שולחן הסנכרון
במקום טריגרים שכותבים ישר ל-pointers (שבירים ולא ניתנים ל-retry), שומרים כאן events ועובד רקע מעבד אותם.

```
id, tenant_id, entity_type, entity_id, op (insert/update/delete),
payload jsonb, processed_at, retry_count, error
```

טריגר אחד פר טבלת מקור (clients/tasks/chat_messages/seo_reports/agent_conversations/mood_status) — **רק כותב ל-outbox**. עובד הרקע `carmen-memory-worker` מעבד מ-outbox: יוצר/מעדכן/סוגר edges, רץ extraction, מחשב embeddings, ובאצ'ים. שורה נכשלת? retry. עובד למטה? אפס איבוד נתונים.

---

## 2. כלים חדשים לכרמן (run-ai-agent)

| כלי | מטרה |
|---|---|
| `kb_list_folder(path)` | ניווט בעץ (`clients/<id>/reports`) — מחזיר ילדים |
| `kb_search(query, filters)` | חיפוש hybrid: pgvector על `summary_embedding` + filter על category/date/entity |
| `kb_open(pointer_id)` | **Sufficiency router**: שולף את ה-pointer + תמיד מצרף את ה-source row החיה מ-Postgres. כך אם הסטטוס של לקוח השתנה — כרמן רואה את העדכני, לא את הסיכום הישן |
| `kb_recall_conversation(topic, date_range)` | חיפוש על `carmen_memory_episodes` |
| `kb_learn(fact, source_ref, category)` | כתיבה ידנית של זיכרון פרוצדורלי ("איך לבצע X") |

הכלים הישנים `save_memory`/`recall_memory` נשארים רק ל-**procedural memory** (העדפות, הוראות) ב-`ai_memory`. כל נתון תפעולי עובר ל-pointers.

---

## 3. Backfill — סקריפט אכלוס ראשוני

Edge function: `carmen-memory-backfill`, idempotent, רץ בbatches עם cursor. עוברת **לכל tenant** ולכל מודול:

1. `clients` → entry פר לקוח עם summary קצר (LLM, ~50 מילים)
2. `seo_reports` + דוחות בdynamic tables → `clients/<id>/reports`
3. `mood_status` changes, `client_health_log` → `clients/<id>/updates`
4. `chat_messages` (last 90 days) → `messages/<date>/<channel>` + cross-link תחת `clients/<id>/communications`
5. `campaigners` + `client_team` + `tasks` → ענף `team/<id>/*`
6. `agent_conversations` קיימות → אפיזודים ב-`carmen_memory_episodes` עם topic clustering
7. `system_map` — entry פר טבלה רלוונטית (clients, leads, tasks, integrations, automations, ai_agents, reports, finance, agencies) עם תיאור איך לשלוף ממנה. **זו המפה שכרמן רואה כשהיא לא יודעת איפה משהו.**

Embeddings מחושבים בbatches (Lovable AI gateway, `google/gemini-embedding-001`). Importance scoring ע"י LLM קצר על summary.

---

## 4. Sync חי — דרך Outbox, לא טריגרים ישירים

טריגרי DB (פשוטים מאוד, רק INSERT ל-outbox):

```sql
CREATE TRIGGER chat_messages_outbox AFTER INSERT ON chat_messages
FOR EACH ROW EXECUTE FUNCTION carmen_outbox_enqueue('chat_message','insert');
-- אותו דבר ל: clients, tasks, seo_reports, mood_status, agent_conversations
```

Edge function `carmen-memory-worker` (קורנית כל דקה או triggered):
1. שולפת batch של 100 שורות לא מעובדות מ-outbox
2. לכל event: יוצרת/מעדכנת pointer (עם `valid_until` על קודמים אם רלוונטי — bi-temporal)
3. במקרה של `chat_message` — מצרפת ל-session פתוח. אם session נסגר (3 דק' שקט) — מריצה extraction → `carmen_memory_episodes`
4. סימון `processed_at`. כשלון → `retry_count++`

זה מה ש-2025 SOTA קוראים לו **Outbox Pattern** (Debezium-style) — מוזכר בכל המאמרים על memory consistency.

---

## 5. Decay & Consolidation — קורנית יומית

`carmen-memory-consolidate` רץ פעם ביום:
- מחשב `retention_score` לכל episode (FadeMem formula)
- מוחק episodes מתחת לסף (ההודעות המקוריות שורדות!)
- ממזג episodes כפולים (אם summary similarity > 0.95)
- **לא נוגע ב-pointers** — pointers לrow אמיתי לעולם לא נמחקים, רק כשהrow המקורי נמחק (מטופל ע"י outbox עם op=delete)

---

## 6. System Prompt — תוספת קצרה לכרמן

```
🧠 ממלכת הידע שלך:
- כל מידע על לקוח/צוות/הודעות יושב ב-carmen_memory_pointers (אינדקס) ו-carmen_memory_episodes (סיכומי שיחות)
- כלל ברזל: לפני שאת שולפת מטבלאות גולמיות — תמיד נסי קודם kb_search או kb_list_folder
- ה-pointers הם **קישורים בלבד**. תוכן עדכני תמיד מ-kb_open (שמחזיר את הrow החי)
- ההיררכיה: clients/<id>/{reports,updates,communications}, team/<id>/{tasks,communications,assigned_clients}, messages/<date>/<channel>, conversations/<topic>/<month>, system_map/<module>
- system_map הוא המפה שלך — שם תמצאי איך לשלוף מכל מודול במערכת
```

---

## 7. קבצים שמשתנים

1. **migration**: 3 טבלאות + RLS + grants + 6 טריגרי outbox + pgvector index (HNSW)
2. **`supabase/functions/run-ai-agent/index.ts`**: 5 כלי `kb_*` + עדכון system prompt + הסרת תלות נתונים תפעוליים ב-`ai_memory`
3. **`supabase/functions/carmen-memory-backfill/index.ts`** (חדש): backfill עם `?tenant_id=&module=all|clients|team|messages|conversations|system_map`
4. **`supabase/functions/carmen-memory-worker/index.ts`** (חדש): מעבד outbox + מריץ extraction על sessions שנסגרו
5. **`supabase/functions/carmen-memory-consolidate/index.ts`** (חדש): decay יומי
6. **pg_cron** schedules: worker (כל דקה), consolidate (יומי 03:00)
7. **`mem://index.md`**: כלל ליבה חדש על ארכיטקטורת הזיכרון

---

## למה זה עדיף על התוכנית הראשונה

| נושא | v1 | v2 |
|---|---|---|
| סנכרון DB | טריגרים ישירים → memory | Outbox → worker (durable, retry-able) |
| חיפוש | path-based בלבד | path + pgvector hybrid |
| עקביות זמנית | אין | Bi-temporal `valid_from/valid_until` |
| הודעות | entry פר הודעה (רעש) | importance filter + episode summaries |
| ניקיון | אין | FadeMem decay על episodes בלבד |
| Source of truth | מעורבל | תמיד Postgres, ה-pointers הם רק "מפה" |
| Sufficiency | תמיד מ-summary | router שמשלב summary + live row |

---

## פתוח לאישור

1. **שמות path באנגלית** (`clients/`, `team/`) או עברית? אנגלית יציבה יותר לטריגרים/קוד; תצוגה לכרמן יכולה להישאר בעברית.
2. **חלון backfill ל-messages**: 90 יום אחורה? יותר/פחות?
3. **רץ קודם backfill** ואז מפעילים את ה-outbox triggers, או הפוך? נכון: outbox קודם (כדי לא להחמיץ events חדשים), אחר כך backfill על היסטוריה.
4. **מודל embeddings**: `google/gemini-embedding-001` (1536 dims) דרך Lovable AI gateway — מסכים?
