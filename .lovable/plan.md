

## תצוגת צ'אט/פרטים לצוות (קמפיינרים) — כמו לקוחות ולידים

### מה נבנה
מסך חדש לצוות בסגנון "צ'אט CRM": רשימת אנשי צוות בצד ימין (25%) ופאנל פרטים בצד שמאל (75%) עם לשוניות — בדיוק כמו הלקוחות. כברירת מחדל יוצג תחת `/t/:tenantSlug/campaigners` במקום הגריד הקיים, עם כפתור מעבר לתצוגת גריד הישנה אם רוצים.

### עמודה ימנית — רשימת צוות
- שדה חיפוש (שם, טלפון, אימייל).
- סינון: פעיל / לא פעיל / הכל.
- כל פריט: שם מלא, תפקיד (מ-`role`), סוכנויות משויכות (מ-`campaigner_agencies`), Badge "פעיל/לא פעיל", מספר לקוחות פעילים (מ-`client_team`).
- בחירת איש צוות פותחת אותו בפאנל השמאלי.

### עמודה שמאלית — פרטי איש צוות + לשוניות
חלק עליון (Header):
- שם איש הצוות (עריכה inline → `campaigners.full_name`).
- טלפון, אימייל, תפקיד (עריכה inline).
- סוכנויות משויכות (תצוגה + כפתור עריכה שפותח את `EditCampaignerDialog` הקיים).
- Toggle "פעיל".

לשוניות (`Tabs`):
1. **פרטים** — שדות עריכה: `phone`, `email`, `role[]`, `notes`, ניהול `campaigner_agencies`. שימוש חוזר בלוגיקה מתוך `EditCampaignerDialog`.
2. **לקוחות משויכים** — הבלוק הקיים מ-`Campaigners.tsx` (טבלת `client_team` עם שם לקוח + עמודת תשלום ל-canViewFinance + שורת סה"כ).
3. **משימות** — רכיב חדש `CampaignerTasksTab` בהשראת `ClientTasksTab`:
   - שאילתה: `tasks.select(...).eq("campaigner_id", campaignerId)` עם פילטר תאריך (שבוע/חודש/הכל).
   - שתי עמודות: בביצוע / הושלם, שינוי סטטוס, פתיחת `EditTaskDialog`.
   - כפתור "הוסף משימה" שפותח `AddTaskForm` עם `defaultCampaignerId={campaignerId}` ו-`task_category="quick"` כברירת מחדל (המשתמש יוכל לשייך ללקוח/ליד אם רוצה).
4. **פגישות** — רכיב חדש `CampaignerMeetingTab` בהשראת `ClientMeetingTab`:
   - שימוש ב-`useMeetingScheduler(tenantId)` הקיים.
   - בחירת תאריך + שעת התחלה/סיום + נושא + מיקום + הודעה אישית.
   - "שלח זימון ל:" — האימייל של איש הצוות עצמו (`campaigner.email`) כברירת מחדל מסומן.
   - בנוסף checkbox-ים להזמנת חברי צוות נוספים מהארגון (אותה שאילתת `team-members-for-meeting-tab` הקיימת).
   - הרחבת `useMeetingScheduler.scheduleMeeting` לקבל `contactType: 'lead' | 'client' | 'campaigner'` — במצב `campaigner` לא נעשה `update` בטבלת `leads`/`clients`, רק יצירת אירוע ביומן + טריגר אוטומציה אופציונלי `meeting_created` עם `campaigner_id`.

### קבצים חדשים
- `src/components/campaigners/CampaignersChatView.tsx` — הרכיב הראשי (split + רשימה + header + Tabs).
- `src/components/campaigners/CampaignerTasksTab.tsx` — לשונית משימות.
- `src/components/campaigners/CampaignerMeetingTab.tsx` — לשונית פגישות.

### קבצים לעדכון
- `src/pages/Campaigners.tsx` — להחליף את ברירת המחדל לתצוגת `CampaignersChatView`, עם toggle (Grid / Chat View) שמשמר את הגריד הקיים כאופציה.
- `src/hooks/useMeetingScheduler.ts` — הוספת `'campaigner'` ל-`contactType` ודילוג על עדכון טבלאות לידים/לקוחות במצב הזה.

### מה לא משתנה
- אין שינויי DB / RLS / מיגרציות.
- טבלת `campaigners` ו-`campaigner_agencies` לא משתנות.
- `AddCampaignerForm`, `EditCampaignerDialog`, `AddTaskForm`, `EditTaskDialog` — ללא שינוי, נשתמש בהם כפי שהם.
- מודולי לקוחות/לידים — ללא נגיעה.
- הסיידבר — נשאר כפי שהוא (קמפיינרים תחת "ניהול שוטף").

### בדיקות
1. כניסה ל-`/t/marketingcaptain/campaigners` מציגה רשימת צוות מימין ופאנל פרטים משמאל.
2. בחירת איש צוות מציגה פרטים עדכניים, כולל סוכנויות ולקוחות משויכים.
3. לשונית "משימות" טוענת רק את משימות אותו איש צוות, ניתן להוסיף משימה חדשה משויכת אליו.
4. לשונית "פגישות" יוצרת אירוע ביומן עם זימון לאימייל של איש הצוות (אם קיים) + חברי צוות נבחרים, ללא שגיאות.
5. Toggle Grid/Chat עובד; תצוגת הגריד הישנה ממשיכה לפעול.
6. אין רגרסיה במסכי לקוחות/לידים/משימות.

