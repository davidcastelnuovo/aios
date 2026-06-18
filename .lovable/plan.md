
# חשיפת כל האוטומציות הקבועות במודול משימות סוכנים

המטרה: לראות בפועל את כל המשימות החוזרות שרצות במערכת (כיום cron jobs במסד הנתונים, לא ב-`agent_tasks`), עם סטטוס בזמן אמת, היסטוריית הרצות, ויכולת לערוך/להפעיל/לכבות.

## המצב היום

- ב-`agent_tasks` יש רק משימות `once` (אף `recurring`).
- מה שרץ באמת קבוע נמצא ב-`cron.job` (14 ג'ובים): סנכרוני Facebook/GA/Google Ads, Telegram poll, Carmen memory worker/consolidate, check-overdue-tasks, ועוד.
- אין שום דרך ב-UI לראות אותם, את ההיסטוריה שלהם, או לערוך אותם.

## מה ייבנה

### 1. טאב חדש ב-`AgentTasksPage`: "אוטומציות מערכת"

לצד הטאבים הקיימים (משימות / מטרות / וכו'), טאב חדש שמציג את כל ה-cron jobs ככרטיסי משימה חוזרת — באותו עיצוב של הכרטיסים הקיימים, כדי שיראו אחיד.

לכל ג'וב מוצג:
- **שם ידידותי** ממופה מ-`jobname` (לדוגמה `sync-facebook-insights-twice-daily` → "סנכרון Facebook Insights — פעמיים ביום") + אייקון לפי קטגוריה (סנכרון נתונים / כרמן / תזכורות / טלגרם).
- **תיאור** קצר של מה הג'וב עושה (מילון מובנה בקוד).
- **לוח זמנים** מתורגם לעברית מ-cron (משתמש בפונקציה `describeCron` הקיימת, מורחב למקרי קצה).
- **סטטוס פעיל/לא פעיל** עם Switch.
- **הרצה אחרונה**: זמן + סטטוס (הצליח/נכשל) + משך זמן.
- **סטטיסטיקת 7 ימים אחרונים**: כמה רצו, כמה הצליחו, כמה נכשלו.
- **כפתורים**: "הפעל עכשיו" (קורא ל-edge function ידנית), "ערוך לוח זמנים", "צפה בהיסטוריה" (פותח Drawer).

### 2. Drawer "היסטוריית הרצות"

פותח את 50 ההרצות האחרונות של הג'וב מ-`cron.job_run_details`:
- זמן התחלה, משך, סטטוס (`succeeded`/`failed`), הודעת שגיאה אם נכשל.
- אם ה-`return_message` מכיל request_id, ניתן להציג קישור ללוגי edge function (אופציונלי, לשלב ב').

### 3. דיאלוג עריכת לוח זמנים

מאפשר:
- בחירת preset מתוך `CRON_PRESETS` הקיים, או cron expression מותאם אישית.
- שינוי סטטוס פעיל/לא פעיל.
- שמירה קוראת ל-RPC `update_system_cron_job`.

### 4. צד שרת — RPCs חדשים (SECURITY DEFINER, super_admin בלבד)

המיגרציה תיצור:

- `list_system_cron_jobs()` — מחזיר `jobid, jobname, schedule, active, last_run_at, last_status, last_duration_ms, success_count_7d, fail_count_7d` (JOIN של `cron.job` + `cron.job_run_details`).
- `get_cron_job_history(p_jobid bigint, p_limit int default 50)` — מחזיר את `cron.job_run_details` לג'וב נתון.
- `update_system_cron_job(p_jobid bigint, p_schedule text, p_active boolean)` — קורא ל-`cron.alter_job`.
- `run_system_cron_job_now(p_jobid bigint)` — מבצע את ה-command של הג'וב (`net.http_post` ל-edge function) פעם אחת מיידית.

כל RPC מתחיל ב-`if not public.is_super_admin() then raise exception ...`.

### 5. מילון השמות הידידותיים (frontend)

קובץ `src/lib/cronJobsCatalog.ts` חדש:
```ts
export const CRON_JOB_CATALOG = {
  "carmen-memory-worker-1m": { label: "כרמן — עיבוד זיכרון", category: "carmen", description: "מעבד outbox של זיכרון כל דקה" },
  "carmen-memory-consolidate-daily": { label: "כרמן — איחוד זיכרונות יומי", category: "carmen", ... },
  "sync-facebook-insights-twice-daily": { label: "סנכרון Facebook Insights", category: "sync", description: "מסנכרן ביצועי קמפיינים ויוצר התראות על ירידות הוצאה" },
  // ...כל ה-14 ג'ובים
};
```
ג'וב שאינו במילון יוצג עם `jobname` גולמי + תגית "לא מוגדר".

## מה לא משתנה

- טבלת `agent_tasks` ו-UI שלה נשארים בדיוק כמו שהם — היא נשארת לניהול משימות AI דינמיות שכרמן יוצרת/מקבלת מהמשתמש.
- ה-cron jobs עצמם לא משוכפלים ל-`agent_tasks` (אין מקור-אמת כפול). המודול רק *משקף* אותם.

## פרטים טכניים

- שאילתות מ-`cron.*` דורשות הרשאות מיוחדות → לכן כל הגישה דרך RPCs `SECURITY DEFINER`.
- ה-RPC `run_system_cron_job_now` משתמש ב-`net.http_post` עם ה-URL וה-headers שכבר רשומים ב-`cron.job.command`, אבל מפעיל אותם פעם אחת בלי לשנות את הג'וב.
- הטאב ב-UI חסום ל-super_admin בלבד (אחרת מציג הודעה "אין הרשאה").
- React Query: `queryKey: ['system-cron-jobs']` עם `refetchInterval: 30000` להצגת סטטוס בזמן אמת.

## אישור לפני בנייה

לפני שאני יוצר את המיגרציה והקוד — שתי הבהרות קצרות:
1. **גישה**: לחשוף את הטאב הזה רק ל-super_admin (מומלץ), או גם ל-owner של הטננט?
2. **כפתור "הפעל עכשיו"**: רוצה אותו (מפעיל מיידית את הסנכרון)? או רק תצוגה/עריכה בלי הרצה ידנית?
