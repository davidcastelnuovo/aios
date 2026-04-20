
לתיקון הבעיה של גילי גולדברג אבצע יישור בין מסלול הטעינה הרגיל של דוח ה-SEO לבין מסלול קישור השיתוף, כי כרגע הם לא משתמשים בדיוק באותה לוגיקת פילטור/העשרה.

1. אייצב את טעינת ה-GSC בתוך דוח ה-SEO עצמו  
   - בקובץ `src/components/dynamic-tables/seo/GscIntegration.tsx` יש היום שני fetch-ים מקבילים במצב hidden:
     - fetch רגיל ל-28 יום (`gsc-keyword-data`)
     - fetch נוסף ל-multi-period עם current מורחב (`gsc-multi-period`, 90 יום + aggregateAll)
   - שניהם מעדכנים בפועל את אותו state דרך callbacks, ולכן בטעינה ראשונה הדוח יכול להיבנות על סט חלקי ורק אחרי רענון להציג את כל הביטויים.
   - אשנה את הזרימה כך שבמצב `hideTable` הסט שמשמש את דוח ה-SEO יהיה חד-משמעי: מקור אחד בלבד ל-“current keywords” עבור ההעשרה של Ahrefs+GSC.

2. אחבר את `SeoDashboardView` להגדרות הדוח השמורות  
   - ב-`src/components/dynamic-tables/SeoDashboardView.tsx` אטען גם את הגדרות טבלת ה-SEO (`linkedGscSiteUrl`, ואם צריך גם `linkedGscLangFilter`) ואעביר אותן ל-`GscIntegration`.
   - כך הטעינה הראשונה לא תהיה תלויה רק ב-auto-match אסינכרוני, אלא תשתמש בהגדרת הדוח עצמה כ-source of truth.

3. אסדר את הפילטר/טאב הראשוני של טבלת הביטויים  
   - ב-`src/components/dynamic-tables/seo/SeoKeywordsTable.tsx` אוסיף שליטה מפורשת על הטאב הראשוני/Scope הראשוני.
   - אם ההתנהגות הרצויה היא לראות “כל הביטויים” ולא subset כמו `Top 10`, אגדיר את זה כברירת מחדל בדוח SEO ובקישור השיתוף.
   - בנוסף אדאג שה-counts והטאבים ייגזרו מאותו merged dataset אחרי שההעשרה מוכנה, כדי שלא נראה 29 בטעינה ראשונה ואז 336 אחרי רענון.

4. איישר את קישור השיתוף לאותה לוגיקת תצוגה  
   - בקבצים `src/pages/SharedTable.tsx` ו-`src/components/dynamic-tables/PublicSeoView.tsx` איישר את ברירת המחדל של הטאב/פילטר ואת לוגיקת המיזוג של Ahrefs + GSC לאותה התנהגות כמו בדוח הפנימי.
   - אם יהיה צורך, אעביר גם הגדרות שמורות מתוך `integration_settings` של טבלת ה-SEO אל ה-public view, כדי שקישור השיתוף לא ייפול חזרה לפילטר צר יותר.

5. בדיקות קצה שאוודא אחרי המימוש  
   - פתיחה ראשונה של דוח גילי מתוך המערכת ללא רענון.
   - רענון מלא של אותו דוח.
   - פתיחת קישור השיתוף ישירות.
   - אימות שבשלושת המצבים:
     - אותו מספר ביטויים מוצג
     - אותו פילטר/טאב פתיחה פעיל
     - אין צורך ברענון ידני כדי “לגלות” את כל הביטויים

פרטים טכניים
- קבצים עיקריים:
  - `src/components/dynamic-tables/seo/GscIntegration.tsx`
  - `src/components/dynamic-tables/SeoDashboardView.tsx`
  - `src/components/dynamic-tables/seo/SeoKeywordsTable.tsx`
  - `src/components/dynamic-tables/PublicSeoView.tsx`
  - `src/pages/SharedTable.tsx`
- שורש הבעיה הסביר:
  - race condition בין שני מקורות GSC שונים בטעינה ראשונה
  - וברירת מחדל/פילטר שונה בין המסך הפנימי לבין קישור השיתוף
