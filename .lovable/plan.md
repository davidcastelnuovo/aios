# תיקון "בדיקת חיבור" של Google Ads

## הבעיה
החיבור הישיר ל-Google Ads בפועל **תקין** — ב-DB יש `is_active=true`, `api_key` קיים, `refresh_token` קיים, וה-token רוענן אוטומטית היום ב-08:58. אבל כשלוחצים על "בדיקת סטטוס" מקבלים את ההודעה "החיבור ל-Google Ads לא פעיל".

הסיבה: חוסר התאמה בין השדות שמחזירה הפונקציה לבין השדות שהפרונט בודק.

| מקום | שדה |
|---|---|
| Backend `checkConnectionStatus` מחזיר | `is_connected`, `is_expired`, `expires_at`, `integration_count` |
| Frontend `checkStatusMutation.onSuccess` בודק | `data.connected` ומציג `data.message` |

`data.connected` תמיד `undefined` → ההודעה תמיד שלילית.

## התיקון
ב-`src/pages/GoogleAdsSettings.tsx`, ב-`onSuccess` של `checkStatusMutation`:

1. להחליף את הבדיקה ל-`data?.is_connected && !data?.is_expired`.
2. הודעת ה-success להציג את `integration_count` ואת `expires_at` בעברית.
3. הודעת ה-warning להבחין בין שני מקרים:
   - אין חיבור (`is_connected === false`) → "לא נמצא חיבור פעיל ל-Google Ads".
   - יש חיבור אבל פג תוקף (`is_expired === true`) → "הטוקן פג תוקף, נדרש חיבור מחדש".

## קבצים שישתנו
- `src/pages/GoogleAdsSettings.tsx` — תיקון `checkStatusMutation.onSuccess` (כ-6 שורות).

ללא שינויים ב-edge function, ללא שינויי DB, ללא נגיעה ב-GA/GSC.
