
מה מצאתי:
- התיקון הישן כבר קיים בקוד הנוכחי ב-`src/components/forms/EditLeadDialog.tsx`: יש גם `form.reset(...)` כש-`lead.id` משתנה וגם טעינה מחדש של `lead-detail`.
- לכן זו כנראה לא אותה תקלה ישנה של `react-hook-form` בלבד.
- ההבדל החשוב הוא שבכרטיסיות/כרטיסים כל ליד פותח `EditLeadDialog` משלו, אבל ב-`LeadsChatView` יש דיאלוג אחד משותף שנשען על `selectedLead` חי. זה מסביר למה הבעיה מופיעה רק בתצוגת הצ'אט של הלידים.

מה אבנה:
1. אטפל ספציפית ב-`LeadsChatView`
- אחליף את הזרימה מ-`selectedLead` חי ל-`editingLead` נפרד.
- בלחיצה על עריכה אשמור snapshot של הליד הנבחר (`editingLead`) ורק אותו אעביר לדיאלוג.
- כך החלפת ליד ברשימה או state פנימי אחר לא ימשכו בטעות פרטים של ליד אחר.

2. אחזק את `EditLeadDialog` לשימוש מבוקר
- אוסיף תמיכה ברכיב בלי trigger פנימי כשמשתמשים בו במצב controlled.
- ב-`LeadsChatView` ארנדר את הדיאלוג כ-`key={editingLead.id}` כדי לכפות remount מלא לכל ליד.
- אסגור ואנקה `editingLead` ב-`onOpenChange(false)`.

3. אבדוק אם נשאר state דולף בתוך הדיאלוג
- אאפס גם state פנימי משני אם צריך (למשל tab פעיל / selected sales people / קבצים) כדי לוודא שאין זליגה בין לידים.

קבצים שכנראה ישתנו:
- `src/components/leads/LeadsChatView.tsx`
- `src/components/forms/EditLeadDialog.tsx`

למה אני חושב שזה המקור:
- בכרטיסיות זה עובד כי כל שורה מרנדרת `EditLeadDialog` נפרד עם `lead` קבוע.
- בצ'אט יש דיאלוג משותף אחד: `EditLeadDialog lead={selectedLead} open={editDialogOpen}`.
- זה דפוס קלאסי שיכול להשאיר dialog state/query/form על ליד קודם גם כשיש כבר reset חלקי.

בדיקות שאעשה אחרי המימוש:
- עריכה של רחלי
- עריכה של צחי קוטנסקי
- בדיקה שהדיאלוג לא מושך פרטים של נדב
- בדיקה שבכרטיסיות עדיין תקין
- בדיקה גם ב-preview וגם אחרי publish כדי לוודא שאין פער גרסה

פירוט טכני:
- לא נדרש שינוי מסד נתונים.
- לא אגע ב-RLS.
- זה תיקון Frontend ממוקד בזרימת state והרכבת הדיאלוג.
