## תיקון Manus WhatsApp Gateway Timeout

### בעיה
שליחת הודעות של כרמן לקבוצות WhatsApp דרך Manus Gateway נכשלת ב-`timeout of 8000ms exceeded`. ה-Gateway איטי לפעמים, במיוחד בקבוצות.

### שינויים

**קובץ:** `supabase/functions/send-manus-wa-message/index.ts`

1. **הגדלת timeout** מ-8s ל-25s באמצעות `AbortController` על ה-fetch ל-Manus.
2. **Retry יחיד** (סה"כ 2 ניסיונות) רק במקרה של timeout/network error — לא על שגיאות 4xx מ-Manus.
3. **המתנה של 2 שניות** בין הניסיונות.
4. **לוגים מפורטים** לכל ניסיון (attempt 1/2, משך זמן, סטטוס).

### לא משתנה
- פורמט הבקשה (`{ groupId, body }` ל-`/send/group`)
- זיהוי היעד (`chatId` כפי שמגיע מהטריגר)
- כל שאר ההתנהגות של כרמן/automations

### אימות
לאחר הפריסה — לבדוק לוגים של `send-manus-wa-message` בריצה הבאה ולוודא שאו עבר בניסיון 1, או נעשה retry שהצליח.
