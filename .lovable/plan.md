להלן מפרט שאפשר לשלוח לצוות Manus. אני אכין אותו גם כקובץ מסמך אם תאשר.

---

# Manus WA Webhook — מפרט payload נדרש

## הבעיה הנוכחית
Webhook נכנס מ-Manus כולל היום רק:
```json
{
  "instanceId": "YwIn7GY3Ul3OAxXG",
  "from": "224686986293269",
  "body": "כרמן שומעת",
  "timestamp": 1781867346
}
```

`from` מכיל **WhatsApp LID** (Linked Identity, 15 ספרות, לא E.164), בלי מספר טלפון אמיתי. אין דרך לזהות מי השולח, לא ניתן להחיל whitelist/session/scoping, וההודעה נדחית כ-`no_session_inbound`.

## מה אנחנו צריכים לקבל
לכל אירוע הודעה (גם נכנסת וגם יוצאת), שדות אלה — חובה:

| שדה | סוג | חובה | תיאור |
|---|---|---|---|
| `instanceId` | string | חובה | מזהה מכשיר Manus (כבר קיים) |
| `messageId` | string | חובה | מזהה הודעה ייחודי לדדופ |
| `timestamp` | number (epoch sec) | חובה | זמן ההודעה |
| `direction` | `"inbound"` \| `"outbound"` | חובה | במקום `fromMe` בלבד — מפורש |
| `chatId` | string | חובה | המזהה הגולמי של WhatsApp (LID או phone@c.us או group@g.us) |
| `chatType` | `"private"` \| `"group"` | חובה | סוג השיחה |
| `senderPhone` | string E.164 (ללא +) | **חובה כשניתן לפתור** | מספר הטלפון האמיתי של השולח (למשל `972549696673`). חובה לבצע resolve מ-LID לפני שליחה. |
| `senderLid` | string | אופציונלי | ה-LID הגולמי, אם קיים |
| `senderName` | string | מומלץ | שם תצוגה של השולח |
| `recipientPhone` | string E.164 | **חובה כשניתן לפתור** | המספר אליו נשלחה ההודעה (במקרה שלנו: המספר של מכשיר ה-Manus) |
| `groupId` | string | חובה לקבוצות | LID/phone של הקבוצה |
| `groupName` | string | מומלץ | שם הקבוצה |
| `body` | string | חובה | תוכן ההודעה |
| `mediaUrl` / `mediaType` | string | אופציונלי | אם רלוונטי |

### דוגמה — הודעה פרטית נכנסת
```json
{
  "instanceId": "YwIn7GY3Ul3OAxXG",
  "messageId": "3EB0XXXXXXXXXXXXXXXX",
  "timestamp": 1781867346,
  "direction": "inbound",
  "chatType": "private",
  "chatId": "972549696673@c.us",
  "senderPhone": "972549696673",
  "senderLid": "224686986293269",
  "senderName": "Avi Cohen",
  "recipientPhone": "972507677613",
  "body": "כרמן שומעת"
}
```

### דוגמה — הודעה בקבוצה
```json
{
  "instanceId": "YwIn7GY3Ul3OAxXG",
  "messageId": "3EB0YYYYYYYYYYYYYYYY",
  "timestamp": 1781867400,
  "direction": "inbound",
  "chatType": "group",
  "chatId": "120363012345678901@g.us",
  "groupId": "120363012345678901@g.us",
  "groupName": "צוות שיווק",
  "senderPhone": "972549696673",
  "senderLid": "224686986293269",
  "senderName": "Avi Cohen",
  "recipientPhone": "972507677613",
  "body": "כרמן בדקי דופק"
}
```

### דוגמה — הודעה יוצאת מהמכשיר
```json
{
  "instanceId": "YwIn7GY3Ul3OAxXG",
  "messageId": "3EB0ZZZZZZZZZZZZZZZZ",
  "timestamp": 1781867500,
  "direction": "outbound",
  "chatType": "private",
  "chatId": "972549696673@c.us",
  "senderPhone": "972507677613",
  "recipientPhone": "972549696673",
  "body": "ההודעה ששלח המכשיר"
}
```

## דרישות מפתח
1. **LID resolution חובה** — לבצע lookup מ-LID למספר טלפון אמיתי לפני שליחת ה-webhook (WhatsApp Web/Multi-Device Protocol מאפשר זאת דרך contact sync). אם resolve נכשל — לשלוח את ה-LID ב-`senderLid` **וגם** לשלוח ניסיון כל-שהוא ב-`senderPhone` (או null מפורש), אבל לא להשמיט את השדה.
2. **E.164 ללא `+`** — תמיד פורמט אחיד (`972549696673`), לא `+972...` ולא `0549696673`.
3. **`direction` מפורש** במקום הסתמכות רק על `fromMe`.
4. **שדות בקבוצה** — `groupId` ו-`senderPhone` חייבים להיות נפרדים. היום `from` מבלבל בין השניים.
5. **`messageId` יציב** — אותו ID לאותה הודעה גם אם ה-webhook נשלח שוב (retry).
6. **תאימות לאחור** — לשמור את `from`/`fromMe` הקיימים לתקופת מעבר, אך להוסיף את השדות החדשים מיידית.

## מה זה פותר אצלנו
- Carmen תזהה מי השולח האמיתי → תפעיל whitelist/scoping נכון.
- שיוך משימות לקמפיינר לפי `senderPhone` יעבוד.
- Dedup נקי לפי `messageId`.
- תמיכה תקינה בקבוצות (להבדיל בין שולח לקבוצה).
- אפשר לפצל בין מכשירים מרובים לפי `recipientPhone`.

## אישור
לאשר את המפרט, להוסיף/לגרוע שדות, או שאני אכין גרסת אנגלית של המסמך לשליחה לצוות Manus?