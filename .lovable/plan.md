## הבעיה

הדוח הפנימי של תבניכול עובד יפה, אבל הקישור הציבורי `/shared/table/tbnykvl-z987` מציג "אין דוחות SEO".

## שורש הבעיה

טבלת ה-CRM של תבניכול מקושרת לשני מזהי לקוחות שונים:

- `crm_tables.client_id` = `7844b22e...` ("פעמית עסקים")
- `integration_settings.clientId` = `3a5408b1...` ("פעמית סטור" — שזה הלקוח שאליו באמת שייך הדומיין `www.tavnicol.co.il`)

דוחות ה-Ahrefs של תבניכול נשמרו עם `client_id = 3a5408b1`. הדוח הפנימי (`useAhrefsReports`) מסתמך על ה-`clientId` שמגיע מ-`integration_settings`/URL ולכן מוצא אותם.

לעומת זאת, ה-edge function `public-table` בודק:
```ts
const targetClientId = table.client_id || settings.clientId;
```
ולכן מעדיף את `7844b22e` הלא-נכון, ולא מחזיר אף דוח Ahrefs ⇒ מסך ריק.

## התיקון

**קובץ יחיד**: `supabase/functions/public-table/index.ts`

1. שינוי סדר ההעדפה ל-`settings.clientId || table.client_id` כדי להתיישר עם הלוגיקה של הדוח הפנימי.
2. הוספת fallback: אם עדיין לא נמצאו דוחות וקיים `targetDomain` ב-`integration_settings`, לבצע שאילתה נוספת לפי `domain` בלבד (חוצה את כל ה-`accessibleTenantIds`) — כך שגם טבלאות עם `client_id` שגוי או חסר עדיין יציגו את הדוחות.
3. החלת אותו תיקון על איתור טבלאות GA/GSC המקושרות (אם הן מתבססות על `targetClientId`).

זה מסדר את תבניכול וגם מונע את אותה תקלה בכל קישור שיתוף עתידי שבו `client_id` של הטבלה לא תואם ל-`integration_settings.clientId`.

## בדיקה

לאחר הפריסה אנווט ל-`https://after-lead.com/shared/table/tbnykvl-z987` ואוודא שמופיע אותו דוח SEO שרואים בתצוגה הפנימית, כולל ה-KPIs, הדומיינים והגרפים.
