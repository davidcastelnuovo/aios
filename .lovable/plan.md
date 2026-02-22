

# תיקון: ליד נעלם אחרי שינוי סטטוס/סטטוס תגובה עם טעינת עוד 50

## הבעיה
שתי בעיות משולבות:

1. **Optimistic Update שבור בקנבן**: הקוד בודק `Array.isArray(updated[stageKey])` אבל המבנה האמיתי של הנתונים הוא אובייקט עם שדה `leads` בתוכו (לדוגמה `{ new: { id, color, label, leads: [...] } }`). לכן העדכון האופטימיסטי לא באמת עובד.

2. **invalidateQueries מאפס את accumulatedLeads**: גם ב-`updateLeadStatus` (onSettled) וגם ב-`updateLeadResponseStatus` (onSuccess), הקריאה ל-`invalidateQueries` גורמת לטעינה מחדש של 50 הלידים הראשונים בלבד. לידים שנטענו עם "טען עוד" נעלמים.

## הפתרון

### קובץ: `src/pages/Leads.tsx`

#### 1. תיקון updateLeadStatus
- תיקון ה-optimistic update בקנבן: לעבור על `updated[stageKey].leads` במקום `updated[stageKey]`
- הוספת עדכון אופטימיסטי גם ל-`accumulatedLeads` (העברת הליד מהשלב הישן לחדש)
- בביטול ה-`invalidateQueries` ב-onSettled והחלפתו בעדכון ממוקד שלא מאפס את הנתונים שנטענו

#### 2. תיקון updateLeadResponseStatus
- הוספת עדכון אופטימיסטי ב-onMutate (כמו שנעשה ל-follow_up_date)
- עדכון ישיר של הקאש ו-accumulatedLeads
- הסרת invalidateQueries מ-onSuccess

#### 3. עדכון הקאש הנכון
במקום `invalidateQueries` שמאפס הכל, נעדכן ישירות את הנתונים בקאש:
- ב-onMutate: עדכון אופטימיסטי מיידי (הליד זז לעמודה החדשה)
- ב-onSuccess: עדכון ממוקד של הרשומה הספציפית
- ב-onError: החזרה למצב הקודם (rollback)

### התנהגות צפויה לאחר התיקון
- שינוי סטטוס ליד ישתקף מיידית בתצוגה (הליד יעבור לעמודה הנכונה)
- שינוי סטטוס תגובה ישתקף מיידית
- לידים שנטענו עם "טען עוד" לא יתאפסו
- המיקום בגלילה יישמר

