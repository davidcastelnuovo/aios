# תיקון כפילות בהתראות על משימה חדשה

## הסיבה לכפילות

כשפליקס יוצר משימה, האוטומציה `task_assigned` נורית **פעמיים**:

1. **טריגר DB** — `trg_notify_task_assigned` על טבלת `tasks` (AFTER INSERT OR UPDATE OF campaigner_id) קורא ל-`trigger-automation` עם `trigger_type='task_assigned'`.
   (מיגרציה `20260527143514_*.sql`)

2. **קריאה מהפרונט** — `src/components/forms/AddTaskForm.tsx` (שורות 354-371) קורא ל-`trigger-automation` עם אותו `trigger_type='task_assigned'` מיד אחרי ה-insert.

בנוסף, `supabase/functions/webhook-task-intake/index.ts` (שורות 448-480) קורא ל-`task_assigned` אחרי insert של משימה דרך webhook — גם זה כפול מול ה-DB trigger.

## הפתרון

נשאיר את **טריגר ה-DB כמקור יחיד** ל-`task_assigned`, כי הוא תופס כל מסלול יצירה (טופס, AI agent כרמן, webhook, אוטומציות אחרות, סנכרון), ונסיר את הקריאות הכפולות מהקוד.

### שינויים

1. **`src/components/forms/AddTaskForm.tsx`** — להסיר את הבלוק `await supabase.functions.invoke('trigger-automation', { body: { trigger_type: 'task_assigned', ... } })` (שורות 353-371). ה-DB trigger ידאג לזה.

2. **`supabase/functions/webhook-task-intake/index.ts`** — להסיר את הבלוק "Also trigger task_assigned automation if campaigner was assigned" (שורות 448-480). ה-DB trigger יטפל בזה אוטומטית כשה-task נכנס עם `campaigner_id`.

3. ללא שינויים ב:
   - `EditTaskDialog.tsx` — שולח `task_calendar_created` (לא קשור).
   - `trigger-automation` — נשאר כפי שהוא; ה-deduplication נעשה במקור.
   - שאר הטריגרים (`task_overdue`, `task_status_changed`) — לא משפיעים.

## בדיקה אחרי

יצירת משימה ידנית דרך הטופס וצפייה בלוגים של `trigger-automation` — צריך להופיע ריצה אחת בלבד של `task_assigned` במקום שתיים.
