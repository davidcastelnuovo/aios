# Carmen Meeting Bot (Recall.ai)

כרמן מצטרפת כמשתתפת גלויה לפגישות **Zoom**, **Google Meet** ו-**Microsoft Teams** — גם עם קישור ידני (בלי זימון ביומן).

## זרימה

1. `dispatch-meeting-bot` — יוצר `meeting_bot_sessions` ושולח בוט ל-Recall.ai
2. הבוט מצטרף לפגישה בשם **"כרמן AI — מסייעת תמלול"**
3. `meeting-bot-webhook` — מקבל אירועי Recall (`bot.done` וכו')
4. בסיום: הורדת וידאו + תמלול → `zoom_recordings` (`source=meeting_bot`) → pipeline משותף (סיכום + בריף)

## התאמה אוטומטית ליומן

לפני שיוך AI, ה-pipeline מחפש ביומני Google המחוברים לארגון אירוע Zoom שהזמן שלו
חופף להתחלת ההקלטה (עד 30 דקות סטייה). כשנמצאה התאמה:

- שם ההקלטה משתנה לכותרת האירוע ביומן.
- אם שם לקוח אחד מופיע במפורש בכותרת, כל קבצי אותה פגישה משויכים אליו.
- שיוך לקוח קיים לעולם אינו נדרס.
- `calendar_event_id` נשמר כדי שההתאמה תהיה אידמפוטנטית ושינוי שם ידני מאוחר יותר יישמר.

אותו matcher משותף משמש גם הקלטות Recall, הקלטות Zoom webhook, משיכה ידנית
מ-Zoom והקלטות התוסף.

## סודות (Supabase Edge Functions)

| Secret | חובה | תיאור |
|--------|------|--------|
| `RECALL_API_KEY` | כן | API key מ-[Recall.ai](https://www.recall.ai/) |
| `RECALL_REGION` | **כן (EU)** | `eu-central-1` לאירופה (Frankfurt). ברירת מחדל בקוד: `us-east-1` — בלי הגדרה מקבלים 401 |
| `RECALL_WORKSPACE_VERIFICATION_SECRET` | מומלץ | `whsec_...` לאימות webhooks |
| `RECALL_ZOOM_BOT_EMAIL` | לא | רק לפגישות Zoom שדורשות אימייל (למשל `carmen@aios.co.il`) — **לא צריך חשבון Zoom אמיתי** |

## Webhook ב-Recall Dashboard

URL:
```
https://zvoijyneresvkadpprel.supabase.co/functions/v1/meeting-bot-webhook
```

אירועים: `bot.joining_call`, `bot.in_waiting_room`, `bot.in_call_recording`, `bot.call_ended`, `bot.done`, `bot.fatal`

מומלץ להוסיף גם `transcript.done` ו-`recording.done`: `bot.done` נשלח כשהבוט יוצא מהפגישה, אבל התמלול עדיין בעיבוד — במיוחד בפגישות ארוכות.

## השלמה אוטומטית (`meeting-bot-reconcile`)

cron כל דקה מאתר סשנים שנתקעו ב-`processing` (התמלול לא היה מוכן ב-`bot.done`, או שהעתקת וידאו ארוך חרגה ממשאבי הפונקציה) ומסיים אותם מול Recall. אפשר להריץ ידנית לסשן מסוים:

```bash
curl -X POST "$SUPABASE_URL/functions/v1/meeting-bot-reconcile" \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"session_id":"..."}'
```

## אימייל — מתי צריך?

- **רוב הפגישות (Zoom רגיל, Meet, Teams):** לא צריך אימייל — רק קישור.
- **Zoom עם "Require authentication to join" / webinar עם רישום:** הגדירו `RECALL_ZOOM_BOT_EMAIL` — כל כתובת תקפה (לא חייבת להיות משתמש Zoom).

## שימוש

### UI
עמוד **הקלטות** → "שלח את כרמן לפגישה" → הדבקת קישור + לקוח אופציונלי.

### כרמן
כלים: `join_meeting_for_client`, `get_meeting_bot_status`

### API
```bash
curl -X POST "$SUPABASE_URL/functions/v1/dispatch-meeting-bot" \
  -H "Authorization: Bearer $USER_JWT" \
  -H "Content-Type: application/json" \
  -d '{"meeting_url":"https://meet.google.com/abc-defg-hij","client_id":"...","meeting_topic":"פגישת לקוח"}'
```
