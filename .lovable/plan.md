## הבעיה

כרמן ענתה פעמיים על "את עדיין מחוברת?". הסיבה היא בצד שלנו, ב-edge function `send-manus-wa-message`:

```
[send-manus-wa] POST .../send/text to=972507677613  (attempt 1)
[send-manus-wa] attempt 1 aborted (timeout) { elapsedMs: 25011 }
[send-manus-wa] attempt 2 response { status: 200, ok: true, body: '{"success":true,"messageId":"3EB0E00B428B5E7F5A0272"}' }
```

ה-timeout שלנו (25s) בוטל את הבקשה לפני שהשרת של Manus החזיר תשובה — אבל Manus כן שלח בפועל את ההודעה ל-WhatsApp. ה-retry שלח את אותה הודעה שוב, ולכן המשתמש קיבל אותה פעמיים. ה-dedup הקיים ב-`manus-wa-webhook` הוא לפי `messageId` של הודעות נכנסות בלבד, אז הוא לא מגן על שליחה יוצאת.

## הפתרון

**1. `supabase/functions/send-manus-wa-message/index.ts`**
- להאריך את ה-timeout של ניסיון השליחה ל-Manus מ-25s ל-45-60s (Manus לפעמים איטי, וההודעה כבר נשלחה ל-WhatsApp לפני שהתשובה חוזרת).
- להוסיף **idempotency**: לפני ביצוע retry אחרי timeout/abort, לבצע `GET` קצר על סטטוס ההודעה האחרונה לאותו chat דרך Manus (אם נתמך), או — אם לא — פשוט **לוותר על retry במקרה של timeout/abort בלבד**, ולסמן את הניסיון כ-"unknown delivery" ולוג בהתאם. retry יבוצע רק על שגיאות רשת ודאיות (ECONNREFUSED, status 5xx, וכו') ולא על abort של AbortController.
- להוסיף מפתח idempotency פנימי (למשל `idempotencyKey = ${automationId}:${runId}:${stepIndex}` או hash של ה-payload+chatId+נסיון) ולשמור אותו ב-cache קצר בטבלת `automation_send_attempts` חדשה (או reuse של טבלה קיימת), כך ש-retry על אותו key יחזיר את התוצאה הקודמת במקום לשלוח שוב.

**2. הגנה נוספת ברמת הקריאה (`_shared/carmen.ts` או הראוטר שמפעיל send-manus-wa-message)**
- לוודא שכרמן לא קוראת ל-send פעמיים בריצה אחת. לבדוק את הלולאה של ה-agent runner ולוודא שיש גרד יחיד של "כבר נשלחה הודעה ל-chat X ב-run הזה".

## פרטים טכניים

- הקובץ הראשי לטיפול: `supabase/functions/send-manus-wa-message/index.ts`.
- שינוי קונפיגורציה: קבועי `TIMEOUT_MS` ו-`MAX_RETRIES`, וטיפול נפרד ב-`error.name === 'AbortError'` (לא לרטריי) לעומת שגיאות רשת אחרות.
- אופציונלית: טבלת `manus_send_attempts(idempotency_key text primary key, sent_at, message_id, response jsonb)` עם TTL של שעה כדי לחסום שליחה כפולה גם בין invocations שונים.

## מה לא משתנה

- שום שינוי באוטומציות עצמן, ב-whitelist קבוצות, או בכרמן הלוגיקה.
- שינוי רק בשכבת המסירה ל-Manus.
