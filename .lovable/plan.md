

# מעבר Google Calendar לחיבור דרך Unified.to

## הרעיון
במקום לחבר את Google Calendar ישירות עם OAuth credentials משלך (שדורש scopes רגישים כמו `calendar.events`), נעביר את החיבור ליומן דרך **Unified.to** שכבר מוגדר במערכת. כך:
- **אימות משתמשים (Sign-In)** — נשאר ישירות מול Google, עם scopes לא רגישים בלבד (`email`, `profile`, `openid`)
- **יומן Google** — עובר דרך Unified.to שכבר מאומת מול Google ולא יציג התראת טסט

## השפעה על Verification
עם השינוי הזה, האפליקציה שלך ב-Google Cloud Console תבקש רק scopes לא רגישים. תהליך ה-Verification יהיה מהיר ופשוט — ללא צורך באודיט אבטחה.

## מה צריך לשנות

### שלב 1: הוספת קטגוריית Calendar ל-Unified.to
- הוספת `calendar` לרשימת הקטגוריות ב-`UnifiedSettings.tsx` (Google Calendar, Outlook Calendar וכו׳)
- המשתמש יחבר את יומן Google דרך ממשק Unified.to הקיים

### שלב 2: Edge Function חדשה — `unified-calendar-proxy`
פונקציה חדשה שתחליף את הקריאות הישירות ל-Google Calendar API:
- **שליפת אירועים** — דרך Unified.to Calendar API (`GET /unified/calendar/{connection_id}/event`)
- **יצירת אירוע** — `POST /unified/calendar/{connection_id}/event`
- **עדכון אירוע** — `PUT /unified/calendar/{connection_id}/event/{id}`
- **מחיקת אירוע** — `DELETE /unified/calendar/{connection_id}/event/{id}`
- הפונקציה תמצא את ה-`unified_connection_id` מטבלת `tenant_integrations` לפי tenant + user

### שלב 3: עדכון רכיבי Frontend
קבצים שצריכים שינוי:
- **`src/components/InteractiveCalendar.tsx`** — להחליף קריאה ל-`get-calendar-events` בקריאה ל-`unified-calendar-proxy`
- **`src/components/CalendarIframeSettings.tsx`** — להחליף `add-calendar-event`
- **`src/components/tasks/WeeklyTaskBoard.tsx`** — להחליף `get-calendar-events`, `add-calendar-event`, `sync-tasks-to-calendar`
- **`src/components/forms/EditTaskDialog.tsx`** — להחליף `get-calendar-events`, `add-calendar-event`
- **`src/components/CalendarView.tsx`** — להחליף בדיקת חיבור מ-`calendar_tokens` לבדיקה ב-`tenant_integrations`

### שלב 4: עדכון Edge Functions קיימות
- **`add-calendar-event`** — לנתב דרך Unified.to API במקום Google ישירות
- **`get-calendar-events`** — אותו שינוי
- **`update-calendar-event`** — אותו שינוי
- **`delete-calendar-event`** — אותו שינוי
- **`sync-tasks-to-calendar`** — לשנות לשימוש ב-Unified.to API

### שלב 5: ניקוי
- טבלת `calendar_tokens` תישאר זמנית לתמיכה בחיבורים קיימים, אבל חיבורים חדשים יעברו דרך Unified.to
- הסרת ה-scope `https://www.googleapis.com/auth/calendar` מה-OAuth flow ב-`google-calendar-auth`

## סיכום קבצים לשינוי
| קובץ | שינוי |
|---|---|
| `src/pages/UnifiedSettings.tsx` | הוספת קטגוריית Calendar |
| `supabase/functions/unified-calendar-proxy/index.ts` | **חדש** — proxy ל-Unified.to Calendar API |
| `src/components/InteractiveCalendar.tsx` | שינוי קריאות API |
| `src/components/CalendarIframeSettings.tsx` | שינוי קריאות API |
| `src/components/tasks/WeeklyTaskBoard.tsx` | שינוי קריאות API |
| `src/components/forms/EditTaskDialog.tsx` | שינוי קריאות API |
| `src/components/CalendarView.tsx` | שינוי בדיקת חיבור |
| Edge Functions קיימות (5) | עדכון לשימוש ב-Unified.to |

## תוצאה
- משתמשים מחברים יומן דרך Unified.to (ללא התראת טסט)
- Google Sign-In נשאר ישיר עם scopes לא רגישים בלבד
- Verification פשוט ומהיר

