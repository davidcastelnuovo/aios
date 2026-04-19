

## הבעיה
בצילום המסך מכרטיס הלקוח (תמונה 272) יש שטח לבן ריק ענק מתחת לטבלת הסיכום. המשתמש רוצה שהצילום יציג רק את הטבלה — בדיוק כמו שמתבצע מהדיאלוג בתוך הטבלה עצמה, בלי הרווח הלבן המיותר.

## ניתוח
ב-`ClientTableSnapshot.tsx` מוגדר `minHeight: "600px"` על ה-container — זה מה שיוצר את הריבוע הלבן הענק כשהתוכן (טבלת סיכום בלבד) קצר מ-600px.

בנוסף, ה-container ב-`DynamicTableView` עצמו עשוי לכלול padding/min-height של viewport (`min-h-screen` וכד') שמייצר רווח נוסף.

## התיקון

### 1. `src/components/clients/ClientTableSnapshot.tsx`
- להסיר את `minHeight: "600px"` מה-wrapper.
- להוסיף `display: "inline-block"` או `height: "auto"` כדי שה-container יתכווץ בדיוק לגובה התוכן.

### 2. `src/pages/DynamicTableView.tsx`
- כש-`summaryOnly` פעיל, להחיל class container מצומצם (ללא `min-h-screen` / padding גדול) כדי שהקומפוננטה תתפוס בדיוק את גובה טבלת הסיכום.
- לוודא שה-container הראשי משתמש ב-`h-auto` במצב summaryOnly במקום `h-screen`/`min-h-screen`.

### 3. בדיקה שלוגיקת ה-html-to-image
- צילום המסך מבוצע על ה-`ref` של ה-wrapper. אחרי שה-wrapper יתכווץ לגובה התוכן בלבד, הצילום יכלול רק את הטבלה ללא רווח לבן.

## תוצאה צפויה
צילום המסך בכרטיס הלקוח יציג רק את שורות "מעורבות 18.8 - מסנג'ר" + "סה"כ" בתוך מסגרת הטבלה — בדיוק כמו שמופיע בדיאלוג של הטבלה הדינמית, בלי שטח לבן ריק מתחת.

## היקף
- 2 קבצים: `src/components/clients/ClientTableSnapshot.tsx`, `src/pages/DynamicTableView.tsx`
- ללא שינויי DB, ללא Edge Functions

