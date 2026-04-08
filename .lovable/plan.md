

# תוכנית שדרוג מודול משימות כרמן - בהשראת Paperclip

## רקע
Paperclip הוא מערכת אורקסטרציה לסוכני AI שמנהלת "חברות אוטונומיות" עם מבנה ארגוני, יעדים, תקציבים, Heartbeats ומערכת Tickets מלאה. נייבא את העקרונות הרלוונטיים למודול המשימות של כרמן.

## מצב נוכחי
כרמן כבר תומכת ב: יצירת/עדכון/מחיקת משימות, חיפוש כפילויות, שיוך לקוחות/לידים/קמפיינרים, שותפים למשימה, סנכרון ליומן Google, ובדיקת משימות באיחור עם אוטומציות.

---

## שלב 1: Goal Hierarchy (יעדים היררכיים)
**בהשראת**: Goal Alignment של Paperclip - כל משימה מקושרת ליעד שמקושר למטרה עליונה.

**מה נבנה:**
- טבלת `goals` חדשה: `id, tenant_id, title, parent_goal_id, status, owner_type (agent/campaigner), owner_id, progress_percent, created_at`
- שדה `goal_id` בטבלת `tasks` - כל משימה יכולה להיות מקושרת ליעד
- כרמן תוכל ליצור יעדים (`create_goal`) ולשייך משימות אליהם
- תצוגת עץ יעדים בדף המשימות עם אחוז התקדמות אוטומטי

## שלב 2: Heartbeats - סקירה תקופתית אוטומטית
**בהשראת**: Heartbeats של Paperclip - סוכנים מתעוררים על לוח זמנים, בודקים עבודה, ופועלים.

**מה נבנה:**
- Edge Function `agent-heartbeat` שרצה כל 4/8/12 שעות (מוגדר per-tenant)
- ב-Heartbeat כרמן: סוקרת משימות פתוחות, מזהה חסומות, שולחת תזכורות ב-WhatsApp, מעדכנת סטטוסים, ומדווחת סיכום יומי
- טבלת `heartbeat_logs` לתיעוד כל הרצה: `id, tenant_id, triggered_at, tasks_reviewed, actions_taken, summary`
- הגדרות Heartbeat בממשק ההגדרות (תדירות, שעות פעילות, פעולות מותרות)

## שלב 3: Ticket System - שרשור שיחות על משימות
**בהשראת**: מערכת הטיקטים של Paperclip - כל שיחה מתועדה, כל החלטה מוסברת.

**מה נבנה:**
- שדרוג `task_updates` לתמוך ב-`update_type`: `comment | status_change | assignment | agent_action`
- כל פעולה של כרמן על משימה תתועד אוטומטית (tool call tracing)
- תצוגת Thread בדיאלוג המשימה - היסטוריה מלאה של מי עשה מה ומתי
- Badge על כרטיס משימה שמראה כמה עדכונים חדשים יש

## שלב 4: Agent Task Ownership - בעלות ברורה
**בהשראת**: Atomic Execution ו-Task Checkout של Paperclip.

**מה נבנה:**
- שדה `assigned_agent` בטבלת tasks (nullable) - כרמן יכולה "לקחת" משימה
- סטטוס `agent_working` חדש - כשכרמן עובדת על משימה, היא נעולה
- כרמן מדווחת התקדמות אוטומטית כשהיא מסיימת שלב
- ב-UI: אייקון "כרמן עובדת על זה" על כרטיסי משימות

## שלב 5: Smart Prioritization - תעדוף חכם
**בהשראת**: Goal-aware execution של Paperclip.

**מה נבנה:**
- כלי חדש `prioritize_tasks` לכרמן - מנתחת עומס, דדליינים, ויעדים ומציעה סדר עדיפויות
- הצעת "המשימה הבאה" אוטומטית לקמפיינר כשהוא פותח את הדשבורד
- Alert חכם: "יש 3 משימות שחוסמות את היעד X, כדאי לטפל בהן"

---

## פירוט טכני

### שינויי Database (מיגרציות)
```text
1. CREATE TABLE goals (id, tenant_id, title, description, parent_goal_id, 
   status, owner_type, owner_id, progress_percent, due_date, created_at)
2. ALTER TABLE tasks ADD COLUMN goal_id UUID REFERENCES goals(id)
3. ALTER TABLE tasks ADD COLUMN assigned_agent TEXT
4. CREATE TABLE heartbeat_logs (id, tenant_id, triggered_at, 
   tasks_reviewed INT, actions_taken JSONB, summary TEXT)
5. ALTER TABLE task_updates ADD COLUMN update_type TEXT DEFAULT 'comment'
6. RLS policies על כל הטבלאות החדשות
```

### Edge Functions חדשות/משודרגות
- `agent-heartbeat` - לולאת Heartbeat אוטומטית
- שדרוג `run-ai-agent` - הוספת כלים: `create_goal`, `list_goals`, `prioritize_tasks`, `take_task`, `complete_task_step`

### שינויי Frontend
- רכיב `GoalTree` חדש בדף המשימות
- Thread view ב-`TaskDetailDialog`
- Badge "כרמן עובדת" על `TaskItem`
- הגדרות Heartbeat בדף הסוכנים

### תיקון Build Errors (קודם לכל)
לפני השדרוג, נתקן את 3 הקבצים השבורים:
- `CRMSettingsSection.tsx` - cast ל-any על `seo_monthly_updates`
- `ClientUpdatesTab.tsx` - cast ל-any על `communication_logs` + mood_status
- `ClientsChatView.tsx` - הרחבת טיפוס activeTab ל-9 ערכים

---

## סדר ביצוע מוצע
1. תיקון Build Errors (חובה קודם)
2. שלב 3 - Ticket System (הכי פשוט, ערך מיידי)
3. שלב 4 - Agent Ownership (בסיס לשאר)
4. שלב 1 - Goal Hierarchy (המבנה המרכזי)
5. שלב 2 - Heartbeats (דורש את כל השאר)
6. שלב 5 - Smart Prioritization (שכבת AI על הכל)

