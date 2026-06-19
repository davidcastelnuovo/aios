# הפיכת כרמן להרמס - אימוץ יכולות

המטרה: לא להחליף את כרמן (היא ממשיכה לרוץ ב-edge function בתוך ה-CRM), אלא לאמץ את ארבעת עמודי התווך של הרמס לתוך הארכיטקטורה הקיימת. הפרויקט כבר מחזיק חלק מהתשתית (`ai_skills`, `agent_memory`, `carmen_memory_*`, `agent_mcp_connections`) - הרבה מהעבודה היא להפעיל ולחבר.

## עדיפויות (לפי בחירתך)
1. Skills System
2. Self-improving Memory
3. MCP Integration
4. Subagent delegation

---

## שלב 1 - Skills System (פרוצדורות אוטונומיות)

**הקונספט של הרמס:** סקיל = קובץ markdown עם `name`, `description`, ו-body של "איך לבצע משימה X". הסוכן בוחר סקיל רלוונטי כשהמשימה מתאימה ל-description, ויכול ליצור/לעדכן סקילים בעצמו מתוך התנסות.

**מצב נוכחי:** טבלת `ai_skills` קיימת (9 עמודות, 4 policies) - לבדוק סכמה ולהשלים.

**מה נבנה:**
- ודא ש-`ai_skills` כוללת: `name`, `description`, `body` (markdown), `tenant_id`, `created_by` (`carmen` | user_id), `usage_count`, `last_used_at`, `success_rate`, `version`
- `_shared/skills-loader.ts`: בזמן בנית הפרומפט, שולף Top-K סקילים רלוונטיים לפי matching של ה-description מול הודעת המשתמש (embedding similarity או keyword match - מתחילים ב-keyword)
- שני tools חדשים לכרמן:
  - `create_skill({name, description, body})` - לאחר ביצוע משימה מורכבת מוצלחת
  - `update_skill({id, body})` - לשיפור עצמי על בסיס ניסיון
- Seed ראשוני: ~10 סקילים מבוססי תפקודי הליבה ("ניתוח קמפיין שבועי", "Pulse Check", "החלפת חבר צוות", "הוספת לקוח חדש", "ניתוח SEO")
- UI ב-Settings → AI Agent → Skills לצפייה/עריכה ידנית

---

## שלב 2 - Self-improving Memory

**הקונספט:** הרמס ל-3 שכבות זיכרון: episodic (מה קרה), semantic (עובדות עליך), procedural (סקילים). בנוסף יש "nudges" - הסוכן מחליט מתי לשמור ול-FTS5 search חוצה-שיחות.

**מצב נוכחי:** יש כבר `carmen_memory_episodes`, `carmen_memory_pointers`, `carmen_memory_outbox`, `agent_memory`, `ai_memory`, וגם `carmen-memory-*` functions. צריך לוודא שזה מחובר וחי.

**מה נבנה:**
- ניטרול כפילויות: לבחור שכבה אחת ראשית (`agent_memory` עם `kind: episodic | semantic | instruction`)
- **Nudges**: בסוף כל ריצת agent, אם מתקיים אחד מ:
  - המשתמש שיתף עובדה חדשה ויציבה (שם בן/בת זוג, העדפה, חוק עסקי)
  - הופעלה משימה חדשה שלא היתה לה סקיל
  - תיקון מפורש ("לא ככה, אלא...")
  
  → לקרוא ל-LLM קצר ולהציע `save_memory({content, category, importance})`. זה כבר חלקית קיים (memory ב-keywords עברית "תזכרי/זכרי") - להרחיב להיות אוטונומי ולא רק על מילות מפתח.
- **Cross-session FTS recall**: להוסיף `tsvector` column ל-`agent_memory` עם GIN index, ופונקציה `recall_memory(query, tenant_id, limit)`. בכל בניית פרומפט, להריץ FTS על הודעת המשתמש ולהזריק Top-5 זיכרונות רלוונטיים.
- **Periodic consolidation**: ה-cron הקיים `carmen-memory-consolidate` ירוץ פעם ביום, יזהה זיכרונות חופפים ומיזוגם, ויסיק עובדות semantic מאפיזודות חוזרות.

---

## שלב 3 - MCP Integration

**הקונספט:** במקום לבנות tool לכל אינטגרציה ידנית (Meta Ads, Google Ads, Notion), כרמן מתחברת ל-MCP servers שמספקים tools מוכנים.

**מצב נוכחי:** טבלת `agent_mcp_connections` קיימת.

**מה נבנה:**
- `_shared/mcp-client.ts` - לקוח MCP על בסיס AI SDK (`@modelcontextprotocol/sdk` או fetch ידני ל-Streamable HTTP עם `Accept: application/json, text/event-stream`)
- בזמן ריצת ה-agent: שלוף את כל ה-MCP connections של ה-tenant במצב `ready`, צור lazy clients, רשום את ה-tools שלהם תחת namespace (`mcp_<server>__<tool>`)
- Edge function חדש `mcp-oauth-callback` ל-OAuth flows
- UI ב-Settings → AI Agent → MCP Connections:
  - הוספת חיבור (URL + auth type)
  - רשימת tools זמינים מכל שרת
  - הפעלה/השבתה של tools ספציפיים (control של scope)
- שימור: tokens מוצפנים ב-DB scope-מוגן ב-RLS לפי tenant + user

**הערה:** Lovable מציעה MCP connectors בצד ה-builder (Notion/Linear וכו'). אלה לא רצים בתוך אפליקציה. הבנייה כאן היא MCP בצד ה-runtime של ה-app - דבר שונה.

---

## שלב 4 - Subagent Delegation

**הקונספט:** כרמן יכולה לפצל משימה למקבילית - "בדוק את 50 הלקוחות במקביל" - כל subagent רץ עם context משלו, מחזיר סיכום.

**מצב נוכחי:** קיים `delegate_to_background` (heartbeat-based, סדרתי). חסר parallelization אמיתי.

**מה נבנה:**
- Tool חדש `spawn_parallel_subagents({tasks: [{prompt, context}], max_concurrency})`
- כל subagent הוא הזמנה רקורסיבית של `run-ai-agent` עם `parent_run_id`, `subtask=true`, ו-system prompt מצומצם (ללא רוב הסקילים, רק ה-tools הנדרשים למשימה)
- שמירת תוצאות ב-`agent_runs` עם `parent_run_id`, ו-`spawn_parallel_subagents` ממתין (Promise.all עד גבול concurrency=5) ומחזיר מערך תוצאות
- שימוש לדוגמה: Pulse Check על 50 לקוחות → 10 subagents במקביל של 5 לקוחות כל אחד

---

## פיצול לסדר ביצוע מומלץ

| שלב | משך | סיכון | תלויות |
|---|---|---|---|
| 1. Skills System | 1-2 sessions | נמוך | אין |
| 2. Memory FTS + Nudges | 1 session | בינוני (DB) | אין |
| 3. MCP Integration | 2-3 sessions | גבוה (OAuth) | אין |
| 4. Subagents | 1 session | בינוני | אין |

ניתן לבצע במקביל את 1+2 או לפצל לסשנים נפרדים לפי בחירה.

## פרטים טכניים

- **אין שינויי schema ל-`ai_agents`** - כל היכולות מצורפות דרך טבלאות נלוות.
- **הכל מאחורי feature flag** ב-`ai_agents.metadata` (`hermes_skills: true`, `hermes_memory_v2: true`, וכו') כדי לא לשבור את V2 הקיים.
- **Logging**: כל קריאה לסקיל / זיכרון / MCP נרשמת ב-`agent_action_log` עם `kind`.
- **תאימות לאחור**: כרמן הקיימת ממשיכה לעבוד בלי שום שינוי אם flags כבויים.

## מה לא נכלל בכוונה

- לא נחליף את ה-runtime ל-Modal/Daytona (דורש מהפכה ארכיטקטונית)
- לא נכניס SOUL.md פורמלי - ההרכב הנוכחי של V2 prompt מספיק
- לא נכניס Voice Mode (רעיון עתידי נפרד)
- לא נסנכרן עם agentskills.io - סקילים יישארו פנימיים לכל tenant

---

**הצעה ראשונה:** להתחיל ב**שלב 1 בלבד** (Skills System) כסשן ראשון - הוא העצמאי ביותר, מחזיר ערך מיידי, ובונה את ה-foundation למה שיבוא. אישור לזה?
