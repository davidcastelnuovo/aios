## הבעיה

הלוגים של `manus-wa-webhook` מראים:
```
event= undefined from= undefined to= undefined fromMe= undefined bodyPreview=
```
רק `instanceId` נקלט. ה-webhook מזהה את החיבור, אבל מאחר ש-`event` הוא `undefined` הוא מחזיר מיד `{ignored: undefined}` ולא קורא ל-`handleCarmenMessage`. לכן כרמן לא מגיבה — לא משנה מה כתוב באוטומציה או ברשימת המספרים המורשים.

הסיבה: שער ה-WhatsApp של Manus שולח את ההודעה במבנה payload שונה (כנראה עטוף ב-`data` / `message` / `payload` פנימי), והקוד הנוכחי קורא ישירות `payload.event`, `payload.from` וכו'.

## התיקון

1. **לוג אבחון זמני** ב-`supabase/functions/manus-wa-webhook/index.ts` — להדפיס את מפתחות ה-payload המלא ברגע שמתקבל, כדי לדעת בוודאות את המבנה שמאנוס שולחת.
2. **נרמול payload** — להוסיף בתחילת ה-handler חילוץ של אובייקט ההודעה האמיתי מכל המבנים הנפוצים של Manus WA Gateway:
   - שטוח: `payload`
   - עטוף: `payload.data`, `payload.message`, `payload.payload`, `payload.body` (כשהוא אובייקט)
   - וריאציות שמות שדות: `messageType`/`type` במקום `event`, `chatId`/`remoteJid` במקום `from`, `text`/`message`/`content` במקום `body`, `key.fromMe` במקום `fromMe`.
3. להמיר את הכל למבנה אחיד שבו שאר הקוד (`event`, `from`, `to`, `body`, `fromMe`, `id`, `senderName`, `author`) ממשיך לעבוד בלי שינוי בלוגיקה של Carmen, הכנסת `chat_messages`, וזיהוי קבוצה/יחיד.
4. **לאחר פריסה** — לקרוא ללוגים שוב, לראות את המבנה בפועל, ולוודא שהפעם נקלטים `event=message`, `from=...`, ו-Carmen מופעלת. אם נדרש כוונון נוסף למפתחות ספציפיים שראינו בלוג — מעדכנים את ה-normalizer.

## מה לא נשנה

- לוגיקת Carmen, RecipientsListEditor, ובחירת ספק/חיבור — לא נוגעים.
- האוטומציה עצמה (Trigger → AI סוכן → שלח WhatsApp) תקינה; הבעיה היא בכניסה של ההודעה הנכנסת בלבד.
- חתימת ה-webhook, ה-secret, וזיהוי ה-integration — כבר עובדים.

## איך נדע שזה עובד

אחרי הפריסה תשלח הודעה אחת לכרמן; הלוגים יראו `event= message from= 972...@c.us bodyPreview= ...` וכרמן תגיב (או נקבל `[carmen]` outcome ברור בלוג שמסביר למה לא הגיבה — למשל cooldown, ואז זו בעיה אחרת שנטפל בה בנפרד).
