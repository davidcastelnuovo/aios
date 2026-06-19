
## אבחון - מה באמת קורה

זה לא קשור לזה שאתה מדבר עליה בצ'אטים אחרים. יש קונפליקט מבני בין שתי האינטגרציות.

הצ'אט "אתה ↔ כרמן" מעובד **פעמיים** במקביל:

1. **Manus** (המספר של כרמן `972549696673`) - מקבל את ההודעה שלך כ-incoming. כאן יש session פעיל (`92c3c531...` מוצמדת ל-Manus integration `982f0092...`).
2. **Green API** (הטלפון שלך `972507677613`) - מקבל את אותה הודעה כ-`outgoingMessageReceived`. כי המספר שלך מופיע ב-`carmen_allowed_phones`, ה-webhook הזה גם נכנס ל-`handleCarmenMessage` במסלול `foreignPhoneAllowed` ופותח/מעדכן **session שני** עם chatId שונה (`972549696673@c.us` במקום `972507677613@c.us`).

מה שזה גורם:
- **כל הודעה ↔ שתי כניסות**: אחת מ-Manus, אחת מ-Green API. אחת זוכה, השנייה נופלת ל-mirror/echo guard ושתיקה (זה ה-`Dropping manual-outbound mirror of recent API send` שראינו בלוגים).
- **שני sessions חיים מקבילים** עם היסטוריות נפרדות → תשובות חצויות, חלק מההודעות נכנסות ל-session "הלא נכון" ונשתקות.
- **session_timeout = 3 דקות** (מוגדר נמוך מדי). אם אתה עונה אחרי 3+ דקות ה-session נסגר בלי שום הודעה, וההודעה הבאה בלי "כרמן" נופלת כ-`no_session_inbound`. ראיתי בלוג `idle for 4.6 min (limit 3) — auto-expiring`.
- ב-DB אני רואה את הדפוס במדויק: ה-session האחרונים יש להם 1-2 turns בלבד, בעוד session מוקדם יותר (08:40) הגיע ל-26-36 turns - לפני שהמספר השני נכנס לתמונה.

לא משחק תפקיד: שיחה עליה בצ'אטים אחרים (חוץ מקבוצה ב-`carmen_allowed_group_ids`) - היא מסוננת ולא פותחת sessions.

## תיקונים

### 1. למנוע sessions כפולים על אותה שיחה (`supabase/functions/_shared/carmen.ts`)
ב-`findCarmenSessionAutomation` כשמשולב `foreignPhoneAllowed`:
- אם האוטומציה pinned ל-integration אחר (Manus) ו-`carmen_integration_id` שונה מה-integration שקרא, **לא** לפתוח/לעדכן session דרך הערוץ הזה. המסלול הזה כיום פותח שיחה מקבילה. נשאיר את `foreignPhoneAllowed` רלוונטי רק כש-**אין** session פעיל בערוץ ה-pinned.
- חלופה פשוטה ובטוחה יותר: ב-`handleCarmenMessage` כש-`isManualOutgoing` ויש על אותו tenant `carmen_whatsapp_sessions` פעיל באותה שעה עם chatId אחר עבור אותו `phoneNumber`/`sourcePhoneNumber` - לרשום `last_message_at` (keepalive) ולחזור `handled: true` בלי לפתוח/לטפל. ההודעה כבר מטופלת על ה-Manus webhook.

### 2. הקשחת mirror-guard
ב-bloc `Dropping manual-outbound mirror` (שורות 700-720): גם להחיל אותו לוגיקה ל-**inbound** mirror על Green API (כשהודעה incoming שווה להודעה שיצאה ב-60 שניות האחרונות מ-Manus). זה מכסה את הצד השני של אותה תקלה.

### 3. הארכת session_timeout ל-10 דקות
לעדכן את ה-step הקיים:
```sql
UPDATE automation_flow_steps
SET configuration = jsonb_set(configuration, '{session_timeout_minutes}', '10')
WHERE id = '464c7119-e267-475c-8ca4-33de1bdcf16d';
```
3 דקות זה אגרסיבי מדי לשיחה אנושית בוואטסאפ.

### 4. לוג ברור כשהודעה נופלת
להוסיף `console.log('[CARMEN] Dropped: dual-channel duplicate', {...})` כשהמסלול החדש מסנן - כדי שבפעם הבאה נוכל לאבחן ב-30 שניות במקום לחפור.

## מה לא נשנה
- whitelisting (העתק לעמודה לא ניגע - `carmen_allowed_phones` תקין).
- כל ה-Manus/LID resolution - זה כבר עובד (`senderPhone` מגיע נכון).
- echo/ack guards הקיימים - הם נחוצים נגד לולאות.

## בדיקה אחרי הפריסה
1. תשלח לכרמן "כרמן בדיקה" ותחכה לתשובה.
2. תענה תוך פחות מ-10 דק' עם שאלה אמיתית - היא צריכה להמשיך.
3. בלוגים של `green-api-webhook` נצפה לראות את ההודעה היוצאת שלך מסומנת `dual-channel duplicate, skipping` ולא יוצרת session שני.
4. שאילתה ב-DB: לוודא ש-`carmen_whatsapp_sessions` מקבל רק חיבור אחד פעיל לכל chat_id, ושמספר ה-turns גדל יציב.
