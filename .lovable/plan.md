

# תיקון עדכון תאריך לחזרה בזמן אמת (ללא איפוס תצוגה)

## הבעיה
כשמעדכנים תאריך לחזרה, הרכיב `FollowUpDatePicker` מבצע `invalidateQueries` על `leads-kanban`, מה שגורם לטעינה מחדש של כל הנתונים ואיפוס ה-state של הלידים שנטענו (accumulatedLeads). התוצאה: המיקום מתאפס, לידים שנטענו בעמודים נוספים נעלמים, וצריך לטעון הכל מחדש.

## הפתרון
עדכון אופטימיסטי ישירות ב-cache של React Query ובסטייט המקומי, בלי לבצע invalidation שגורמת לטעינה מחדש מלאה.

## פרטים טכניים

### קובץ: `src/components/leads/FollowUpDatePicker.tsx`

1. הוספת prop חדש `onOptimisticUpdate` שמאפשר לרכיב האב (Leads.tsx) לעדכן את ה-state המקומי ישירות
2. במקום `invalidateQueries`, ביצוע עדכון אופטימיסטי:
   - עדכון ישיר של ה-query cache של `leads-kanban` ו-`leads-table` עם הערך החדש
   - קריאה ל-`onOptimisticUpdate` לעדכון `accumulatedLeads`
   - ללא invalidation שגורמת לריענון מלא

### קובץ: `src/pages/Leads.tsx`

1. יצירת פונקציה `handleFollowUpDateUpdate(leadId, newDate)` שמעדכנת:
   - את `accumulatedLeads` בסטייט המקומי
   - את `stageLeadsData` בסטייט המקומי
2. העברת הפונקציה כ-prop לכל מופע של `FollowUpDatePicker`

### התנהגות צפויה לאחר התיקון
- עדכון תאריך לחזרה ישתקף מיידית בתצוגה
- המיקום בגלילה יישמר
- לידים שנטענו ב"טען עוד" לא יתאפסו
- אפשר להמשיך לליד הבא ישירות
