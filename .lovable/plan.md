

## הבעיה האמיתית

ה-Green API **לא התנתק ולא פג תוקף**. החיבור שלך פעיל ב-DB:
- `is_active: true`
- `instance_id: 7103335768`
- מעודכן: 14.12.2025

הלוגים של ה-edge function חושפים את הבעיה האמיתית:
```
RangeError: Maximum call stack size exceeded
at index.ts:129
```

### שורש הבעיה
בשורה 129 של `supabase/functions/send-green-api-file/index.ts`:
```ts
const base64Data = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
```

ה-spread operator (`...`) על Uint8Array של קובץ גדול (תמונה/וידאו/אודיו ששלחת) **קורס את ה-stack** ב-Deno כשהמערך עובר את ~100K elements. ההודעה "Green API not configured" שראית היא הודעה מטעה - הפונקציה נופלת לפני שמגיעה לבדיקת ההגדרות, אבל ה-handler במקום אחר מציג הודעה כללית.

בפועל, ה-`base64Data` המחושב בשורה 129 הוא **שריד מיותר** - הקוד משתמש ב-`FormData` עם הקובץ הגולמי לכל סוגי הקבצים (`sendFileByUpload`), ולא משתמש ב-base64 בכלל.

## התיקון

### `supabase/functions/send-green-api-file/index.ts`
**הסרת השורות שגורמות לקריסה (127-129):**
```ts
// Convert file to base64
const arrayBuffer = await file.arrayBuffer();
const base64Data = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
```

הקוד לא משתמש ב-`base64Data` או `arrayBuffer` בהמשך - ה-`uploadFormData` משתמש ב-`file` הגולמי. הסרת השורות תפתור את הבעיה לחלוטין.

### תוצאה צפויה
- שליחת תמונות/וידאו/קבצים/הודעות קוליות תעבוד שוב מיידית
- אין צורך לחבר מחדש את Green API - החיבור תקין
- הקובץ נשלח דרך FormData ישירות ל-Green API (כמו שכבר היה אמור לקרות)

### היקף השינוי
- קובץ אחד: `supabase/functions/send-green-api-file/index.ts`
- הסרת 3 שורות בלבד
- ללא שינויי DB, ללא חיבור מחדש

