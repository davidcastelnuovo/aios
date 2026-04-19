

## הבעיה
הצילום מסך בכרטיס לקוח (פאנל "שלח דוח") מצלם את כל ה-`DynamicTableView` במצב `embedMode`, כולל הטבלה היומית המפורטת שמתחת לטבלת הסיכום של הקמפיינים. המשתמש רוצה שהצילום יציג **רק את טבלת הסיכום של הקמפיינים** (כמו בתמונה — שורות "מעורבות 18.8 - מסנג'ר" וסה"כ), בלי שורות הפירוט היומיות.

## ניתוח
- `ClientReportPanel` משתמש ב-`ClientTableSnapshot` שמרנדר `<DynamicTableView embedTableSlug={...} embedMode />`.
- ב-`DynamicTableView.tsx`, ה-DOM המוצלם הוא הכל בתוך ה-container הראשי, כאשר:
  - **שורות 2366-2786**: `<div ref={summaryTablesRef}>` עוטף את כרטיסי הסיכום של Facebook / FB-Ecommerce / Google Ads (זה מה שרוצים בצילום).
  - **שורות 2789-2810**: דשבורדים נוספים (GA / GSC / Ahrefs).
  - **שורות 2812+**: הטבלה הראשית עם **כל הפירוט היומי** (זה מה שצריך להסתיר בצילום).
- כיום הדגל `isEmbed` (משלב `embedMode` ו-`?embed=1`) מסתיר רק עמודת ה-add-row ועמודת הפעולות, אבל לא את הטבלה היומית עצמה. אסור פשוט להסתיר על בסיס `isEmbed` כי זה ישפיע גם על קישורי השיתוף הציבוריים (`/shared/table/...`) שמשתמשים ב-`?embed=1` ו**צריכים** להראות את הפירוט היומי.

## התיקון

### 1. `src/pages/DynamicTableView.tsx`
- להוסיף prop חדש `summaryOnly?: boolean` ל-`DynamicTableViewProps` (שורה 91-94).
- לשרשר אותו ב-signature של הקומפוננטה (שורה 96).
- בשורות 2789-3017 (דשבורד GA, דשבורד GSC, דשבורד Ahrefs/SEO, **והטבלה הראשית של הפירוט היומי**), לעטוף את הרינדור ב-`{!summaryOnly && (...)}` כך שכשהדגל פעיל יוצגו **רק** טבלאות הסיכום שנמצאות בתוך `summaryTablesRef`.
- חשוב: הדגל `summaryOnly` עצמאי לחלוטין מ-`isEmbed`. שיתופים ציבוריים (`?embed=1`) ימשיכו לראות את כל התוכן כרגיל.

### 2. `src/components/clients/ClientTableSnapshot.tsx`
- להוסיף prop `summaryOnly?: boolean` ל-`Props` (ברירת מחדל `true` כדי לתקן את הבאג).
- להעביר אותו ל-`<DynamicTableView embedTableSlug={tableSlug} embedMode summaryOnly />`.

### 3. ללא שינוי ב-`ClientReportPanel.tsx`
- עובד אוטומטית כי ברירת המחדל ב-`ClientTableSnapshot` תהיה `summaryOnly=true`.

## תוצאה צפויה
- צילום מסך בכרטיס לקוח (Facebook/FB-Ecommerce/Google Ads): מציג **רק** את כרטיס הסיכום של הקמפיינים — בדיוק כמו השורה הירוקה "מעורבות 18.8 - מסנג'ר" + שורת סה"כ בתמונה — בלי טור הפירוט היומי.
- קישור שיתוף ציבורי (`after-lead.com/shared/table/...`): נשאר זהה לחלוטין, מציג את הסיכום + הפירוט היומי.
- צפייה רגילה בטבלה דינאמית: ללא שינוי.

## היקף
- 2 קבצים: `src/pages/DynamicTableView.tsx` (תוספת prop + 4 wrappers `{!summaryOnly && ...}`), `src/components/clients/ClientTableSnapshot.tsx` (תוספת prop והעברה).
- ללא שינויי DB, ללא Edge Functions.

