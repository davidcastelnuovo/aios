# Carmen Command Center — מפת נתונים (שלב 0)

מסמך מיפוי קריאה-בלבד: כל פאנל בדשבורד ← מקור הנתונים שלו ← קיים / חסר.
נסרק: `src/` (פרונט Vite+React), `supabase/functions/` (Edge Functions), `database/schema.sql`, `supabase/migrations/`.

## הבהרה ארכיטקטונית חשובה (פער בין ההנחיות למציאות)

ההנחיות מניחות **droplet** עם שירות Node/Express + WebSocket לצד כרמן. **בפועל אין droplet בקודבייס הזה:**

- פרונט: **Vite + React 18** (לא Next), מתארח ב-**Vercel** (`aios.co.il`), RTL/עברית מובנה (`index.html` → `dir="rtl"`), Tailwind + shadcn/ui, פונט Heebo, recharts לגרפים.
- בקאנד: **Supabase** — Postgres + Edge Functions (Deno). כרמן עצמה = הפונקציה `run-ai-agent` (תומכת SSE streaming) + `_shared/carmen.ts` לווטסאפ.
- עדכונים חיים כבר קיימים דרך **Supabase Realtime** (`postgres_changes`) — בשימוש ב-`Dashboard.tsx` וב-`AIOSDialog.tsx` (מעקב `agent_tasks`).

**המשמעות:** את "שכבת המטריקות" של שלב 1 טבעי לממש כ-**Edge Function(s) + Supabase Realtime** במקום Express+WS על שרת נפרד. אין CPU/RAM/Disk של שרת למדוד (managed hosting) — במקומם אפשר למדוד בריאות/latency של השירותים עצמם. ראו "שאלות פתוחות" בסוף.

## טבלת פאנל ← מקור נתונים ← סטטוס

| # | פאנל בדשבורד | מקור נתונים בפועל | סטטוס |
|---|---|---|---|
| 1 | **הפנים של כרמן** | אין. קיימת רק תמונת webp סטטית (`CARMEN_ICON` ב-`AppLayout.tsx:33`) + אנימציית CSS `carmen-glow` (`tailwind.config.ts:91`) | ❌ חסר — לבנות קומפוננטה חדשה |
| 2 | **Core Overview** (Active/Memory/Voice/Agents/LLMs/System) | הרכבה: `ai_agents` (mood, voice, engine), `carmen_memory_pointers`/`carmen_memory_episodes` (ספירות), `tenant_integrations` (סטטוס LLM/ווטסאפ), `carmen_whatsapp_sessions` (sessions פעילים) | 🟡 חלקי — הנתונים קיימים, אין endpoint מאגד |
| 3 | **פיד מודיעין חי** | `campaign_alerts` (התראות קמפיינים + severity), `error_logs` (שגיאות), `integration_alerts_log` (ניתוקי אינטגרציות), `agent_tasks` עם `task_mode='anomaly_alert'`, משימות באיחור (נגזר) | 🟡 חלקי — מפוזר על 4+ טבלאות, אין פיד מאוחד ואין טבלת notifications |
| 4 | **בדיקות דופק — WhatsApp** | `manus-wa-status` (on-demand בלבד, כותב ל-`tenant_integrations.settings`) | 🟡 חלקי — אין דגימה תקופתית ואין היסטוריה |
| 4 | **בדיקות דופק — DB** | אין | ❌ חסר — צריך probe (שאילתה קלה + מדידת זמן) |
| 4 | **בדיקות דופק — MCP servers** | אין (`claude-mcp`, `system-graph-mcp`, `carmen-admin-mcp` קיימים אך לא מנוטרים) | ❌ חסר |
| 4 | **בדיקות דופק — שרת (CPU/RAM/Disk)** | לא רלוונטי — אין droplet; Supabase/Vercel מנוהלים | ⚠️ להחליף במדדי latency/uptime של edge functions |
| 4 | **היסטוריית uptime** | אין שום time-series של זמינות/latency (`heartbeat_logs.duration_ms` קיים אך לא נכתב) | ❌ חסר — נדרשת טבלה חדשה (למשל `service_health_checks`) |
| 5 | **שימוש ב-API — טוקנים/עלות** | `agent_runs` (tokens — נכתב רק ע"י `run-ai-agent-v2` שאינו בשימוש בצ'אט), `agent_action_log` (v1 כותב רק model+duration, בלי טוקנים), `marketing_runs` (הצינור היחיד המלא: tokens+cost) | ❌ פער מרכזי — **הצ'אט הראשי (`run-ai-agent` v1) לא רושם טוקנים כלל**, ו-`_shared/ai.ts` זורק את אובייקט ה-usage של OpenAI בכל הקריאות |
| 5 | **פילוח שימוש לפי לקוח** | קיים רק לשיווק (`UsagePanel.tsx` על `marketing_runs`); `CostTab.tsx` על `agent_action_log` מציג 0 בפועל | 🟡 חלקי |
| 6 | **משימות** | `tasks` (סטטוסים `open/in_progress/done`, איחור נגזר מ-`due_date` + `overdue_notified_at`), `agent_tasks` (משימות AI מתוזמנות), `manus_tasks` | ✅ קיים — כולל Realtime על `agent_tasks` שכבר עובד ב-`AIOSDialog` |
| 7 | **ציר זמן יומי** | `tasks` (`due_date`+`due_time`+`duration_minutes`), Google Calendar דרך `get-calendar-events`, `agent_tasks.scheduled_at` | ✅ קיים ברובו |
| 8 | **פקודות מהירות** | משימה חדשה → `tasks` insert; בדיקת דופק → הפעלת ה-probe החדש; דוח יומי → `agent-heartbeat` (קיים, cron מוגדר רק בפרוד); שיחה קולית → פאנל הצ'אט | 🟡 חלקי |
| 9 | **צ'אט עם כרמן (טקסט)** | `run-ai-agent` עם `surface:'internal_chat'` + `stream:true` (SSE) — בדיוק מה ש-`AIOSDialog.tsx` עושה היום; היסטוריה ב-`ai_conversations` | ✅ קיים — מתחברים לקיים, לא בונים מוח חדש |
| 10 | **קול — כרמן שומעת (STT)** | `transcribe-voice` (Whisper he + ניקוי תמלול) — כבר בשימוש ב-`AIOSDialog` | ✅ קיים |
| 11 | **קול — כרמן מדברת (TTS)** | `carmen-speak` (OpenAI `gpt-4o-mini-tts`, מחזיר MP3 binary) | ✅ קיים — הערה: הקול hardcoded ל-`shimmer`, העמודה `ai_agents.voice` לא נקראת בפועל |
| 12 | **אודיו-ריאקטיביות לפנים** | אין שום AudioContext/analyser לקול (קיים רק צליל התראה ב-`TeamChat`) | ❌ חסר — לבנות בפרונט (לא דורש backend) |
| 13 | **שיחות — פעילות/ממתינות/נענו היום** | `carmen_whatsapp_sessions` (`active/ended/expired`), `chat_messages` (direction+`read_at`), `ai_conversations` | 🟡 חלקי — אין מושג "ממתינה/נענתה" ברמת שיחה; ניתן לגזור משאילתות |

## נקודות מיפוי מרכזיות (בקצרה)

**שיחות של כרמן** מפוצלות על שלושה מקומות: `ai_conversations.messages` (JSON — הצ'אט הפנימי), `carmen_whatsapp_sessions.conversation_history` (JSON — ווטסאפ), `chat_messages` (שורות גולמיות לכל הודעת ערוץ). באג קיים: `run-ai-agent` לא שומר שיחות `internal_chat` ל-`ai_conversations` (רק המסלול של ווטסאפ מסנכרן) — שיחה חדשה בדיאלוג נשמרת רק ב-state של הדפדפן.

**בריאות מערכת:** `agent-heartbeat` הוא supervisor של משימות (איחורים, משימות תקועות) שכותב ל-`heartbeat_logs` — הוא לא בודק תשתית. אין שום בדיקת בריאות ל-DB/MCP/ווטסאפ באופן פרואקטיבי, אין היסטוריית uptime, ואין טבלת notifications. תזמוני pg_cron חיים רק בפרוד ולא ברפו.

**Auth:** הפרונט קורא ל-edge functions עם Supabase JWT של המשתמש (`Authorization: Bearer`), עם סינון `tenant_id` בכל שאילתה. אין צורך ב-Bearer token נפרד ב-env — מנגנון האבטחה הקיים מכסה את הדשבורד, ושום מפתח API לא מגיע לפרונט (TTS/STT כבר רצים דרך ה-backend).

## רשימת פערים (מה שצריך להיבנות/להשלים)

1. **מדידת שימוש ב-API** — הפער הגדול ביותר. `_shared/ai.ts` ו-`run-ai-agent` v1 זורקים את נתוני ה-usage. נדרש: טבלת `ai_usage_log` (או דומה) + לכידת `usage` בנקודות הקריאה + חישוב עלות לפי מחירון. זה **שינוי בקוד הריצה של כרמן** (אדיטיבי בלבד) — דורש אישור.
2. **בדיקות דופק תשתית** — אין. נדרש: edge function חדשה (`carmen-health-probe`) שדוגמת DB/MCP/Manus-WA/OpenAI ושומרת היסטוריה בטבלה חדשה, מתוזמנת ב-pg_cron. שכבה חדשה לגמרי — לא נוגעת בקוד כרמן.
3. **פיד התראות מאוחד** — קיימות 4+ טבלאות התראות נפרדות; נדרש view/endpoint מאגד (קריאה בלבד — בטוח).
4. **פנים דיגיטליות + אודיו-ריאקטיביות** — פרונט בלבד, קומפוננטה חדשה `<CarmenFace/>`.
5. **סטטוס שיחות "ממתינה/נענתה"** — לא קיים; נגזר משאילתות על `chat_messages`/`carmen_whatsapp_sessions` (קריאה בלבד).
6. **שמירת שיחות internal_chat** — באג קיים ב-`run-ai-agent` (לא שומר ל-`ai_conversations`). תיקון קטן בקוד הריצה — דורש אישור.
7. **`ai_agents.voice` לא מחובר** — TTS hardcoded ל-shimmer. תיקון קטן ב-`carmen-speak` (קורא את העמודה) — דורש אישור.
8. **Uptime/latency time-series** — טבלה חדשה, נכתבת ע"י ה-probe מפער 2.

## שאלות פתוחות ל-David (Checkpoint 0)

1. **ארכיטקטורת שלב 1:** לאשר החלפת Express+WS-על-droplet ב-**Edge Functions + Supabase Realtime** (מתאים לסטאק הקיים, בלי שרת חדש לתחזק)? פאנל "משאבי שרת" יוחלף במדדי latency/uptime של השירותים.
2. **מיקום הדשבורד:** עמוד חדש בתוך אפליקציית AIOS הקיימת (route ייעודי, מקבל auth/tenant בחינם) — או אפליקציה נפרדת? ההמלצה: עמוד בתוך האפליקציה.
3. **שינויים בצד כרמן הדורשים אישור מפורש** (כולם אדיטיביים וקטנים): (א) לכידת usage ב-`_shared/ai.ts` + `run-ai-agent`; (ב) תיקון שמירת שיחות internal_chat; (ג) חיבור `ai_agents.voice` ל-TTS.
