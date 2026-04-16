
מטרה

- להפסיק לחלוטין את השימוש ב-iframe בכרטיס הדוח, כך שתוצג רק תמונת screenshot נקייה ומותאמת.

מה זיהיתי

- `ClientReportPanel.tsx` עדיין מרנדר `<iframe>` בפועל.
- ה-capture נטען מהנתיב `?embed=1`, אבל הנתיב עדיין עטוף ב-`AppLayout`, לכן הכותרת וה-sidebar של המערכת נכנסים לתמונה.
- `captureScreenshot` מחפש `[data-embed-root]`, אבל כרגע אין אלמנט כזה, ולכן הוא נופל ל-`iframeDoc.body` ומצלם את כל האפליקציה — מה שנראה אצלך כמו iframe בתוך הכרטיס.

תוכנית

1. להסיר את ה-iframe מהפאנל
- למחוק את `iframeRef` ואת `<iframe>` מתוך `ClientReportPanel`.
- להפסיק להסתמך על route פנימי בתוך iframe בשביל יצירת התמונה.

2. לבנות קומפוננטת screenshot ייעודית
- ליצור קומפוננטה חדשה, למשל `ClientReportSnapshot` / `TableReportSnapshot`.
- הקומפוננטה תרנדר רק את תוכן הדוח שצריך להופיע בתמונה: נתוני דוח, סיכומים, וטבלת תוצאות רלוונטית.
- בלי header, בלי sidebar, ובלי שום wrapper של המערכת.

3. לצלם source נקי במקום iframe
- לרנדר את קומפוננטת ה-snapshot בתוך container מוסתר מחוץ ללייאאוט דרך portal ל-`document.body`.
- להגדיר לו רוחב capture קבוע ורקע לבן.
- לצלם את ה-container הזה עם `html-to-image`, כך שבכרטיס יופיע רק `<img>` של צילום המסך.

4. להתאים את הגודל בכרטיס
- להשאיר בתצוגה רק תמונת preview עם `object-contain` וגובה מוגבל, כדי שהתמונה תיראה מסודרת ומותאמת לכרטיס.
- לשמור את אותו blob גם לשליחה, כדי שמה שנראה בכרטיס יהיה בדיוק מה שנשלח.

5. לייצב את הזרימה
- להחליף את ה-timeout-ים העיוורים ב-capture אחרי שהנתונים הדרושים נטענו.
- לוודא ש"סנכרן ולכוד" ו"צלם מחדש" עובדים מול אותו source חדש.

QA

- לוודא שבכרטיס הלקוח מופיעה רק תמונה, בלי iframe בכלל.
- לוודא שהתמונה לא כוללת sidebar/header של המערכת.
- לבדוק רענון צילום מחדש.
- לוודא שהתמונה שנשלחת בהמשך זהה לזו שמוצגת בכרטיס.

פרטים טכניים

- קבצים עיקריים:
  - `src/components/clients/ClientReportPanel.tsx`
  - `src/components/clients/ClientReportSnapshot.tsx` (חדש)
  - ייתכן חילוץ לוגיקה משותפת מתוך `src/pages/SharedTable.tsx` או `src/pages/DynamicTableView.tsx`
- אין צורך בשינויי backend / database / RLS.
- אני לא הולך לנסות עוד “להחביא iframe”; אני מחליף את המנגנון כדי שלא יהיה iframe בכלל במסלול הזה.
