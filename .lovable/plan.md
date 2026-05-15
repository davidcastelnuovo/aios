## הבעיה
בתצוגה השבועית של מודול המשימות, גלילה אופקית (ימינה/שמאלה לימים נוספים) לא עובדת כשהסמן נמצא מעל משבצות הזמן עצמן — רק כשהסמן מעל הכותרות/אזור עליון.

## ממצא
ב-`src/components/tasks/DayColumn.tsx` (שורה 291), אזור משבצות הזמן הוא:
```tsx
<div ref={scrollContainerRef} className="flex-1 overflow-y-auto overscroll-contain">
```
- `overflow-y-auto` הופך אותו לסקרולר אנכי משלו.
- `overscroll-contain` (shorthand לשני הצירים) חוסם כל overscroll — כך גם wheel אופקי "נכלא" בקונטיינר במקום להגיע להורה ב-`WeeklyTaskBoard.tsx` (שורה 1353) שהוא `overflow-x-auto`.

תוצאה: deltaY גולל אנכית בתוך היום, deltaX לא מועבר לסקרולר ההורה.

## תיקון
**קובץ אחד:** `src/components/tasks/DayColumn.tsx` שורה 291.

1. להחליף `overscroll-contain` ב-`overscroll-y-contain` — שומר על מניעת overscroll אנכי (לא מטלטל את העמוד), אבל מאפשר ל-wheel האופקי לעלות להורה.
2. כתגבור (ליתר ביטחון על trackpads ב-Chrome): להוסיף `onWheel` handler על אותו div שמזהה כש-`Math.abs(deltaX) > Math.abs(deltaY)`, מוצא את האב הקרוב עם `overflow-x: auto` (closest scrollable ancestor או דרך data-attribute שנוסיף ל-`hidden md:flex` div ב-WeeklyTaskBoard) ומריץ `parent.scrollLeft += e.deltaX`, ואז `e.preventDefault()`.

## מה לא משתנה
- אין שינוי במבנה הקומפוננטות, ב-DnD, או בלוגיקת המשימות.
- התנהגות הגלילה האנכית בתוך כל יום נשמרת.
- אין שינוי בנתונים/RLS/בקאנד.
