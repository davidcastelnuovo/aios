

# תוכנית: הצגת מספר תוצאות ומספור עמודים משופר

## מה צריך לשנות

### 1. הצגת מספר אימיילים שנמצאו
- להוסיף מעל הטבלה או בפוטר שורת מידע: "נמצאו X אימיילים" (באמצעות `resultSizeEstimate` שכבר חוזר מה-API)

### 2. שיפור תצוגת הפוטר - מספור עמודים
- לשנות מ-"עמוד 1" ל-"עמוד 1 מתוך Y"
- חישוב מספר עמודים: `Math.ceil(resultSizeEstimate / 25)` (25 = maxResults)

### שינויים בקוד
**קובץ**: `src/pages/Gmail.tsx`
- בפוטר (שורות ~783-793): להחליף `עמוד {currentPage}` ב-`עמוד {currentPage} מתוך {totalPages}`
- להוסיף מעל הטבלה או בפוטר: `נמצאו {resultSizeEstimate} אימיילים`
- לחשב `totalPages` מתוך `messagesData?.resultSizeEstimate`

> הערה: `resultSizeEstimate` של Gmail API הוא הערכה ולא מדויק ב-100%, אבל נותן אינדיקציה טובה.

