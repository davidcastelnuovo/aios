

# תוכנית: תיקון שם השולח באוטומציות

## הבעיה
כשמשתמשים ב-`{{sender_name}}` בהודעת אוטומציה, המערכת שולחת את הערך הגולמי מ-Green API (`senderData.senderName`) שלפעמים מכיל קוד טכני או מספר טלפון במקום שם אמיתי.

## הפתרון
קובץ אחד לשינוי: **`supabase/functions/trigger-automation/index.ts`**

בפונקציה שבונה את המשתנים (`variables`), נעדיף את `contact_name` (שנשלף מבסיס הנתונים - שם הליד/לקוח) על פני `sender_name` (שמגיע גולמי מ-Green API):

```typescript
sender_name: data.contact_name || data.sender_name || '',
```

כך אם יש שם איש קשר מזוהה בבסיס הנתונים, הוא ישמש. רק אם אין - ייפול ל-`senderData.senderName` מ-Green API.

## פרטים טכניים
- שורה 1817 בקובץ `trigger-automation/index.ts`
- המשתנה `data.contact_name` כבר מגיע מלא מה-webhook (נשלף מטבלת leads/clients)
- אין צורך בשינוי ב-webhook עצמו

