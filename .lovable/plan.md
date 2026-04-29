
## מטרה
1. לתקן את הבאג שגורם ל-Google Analytics להיכשל גם כשהחיבור תקין.
2. להוסיף סנכרון אוטומטי יומי (כל בוקר) לכל חיבורי GA הפעילים.

## חלק 1 — תיקון לוגיקת ה-Token (sync-google-analytics-data)

הבעיה הנוכחית בקוד:
- ריענון token רץ **רק אם** `expires_at` קיים ועבר. אם השדה חסר (חיבורים ישנים) — הקוד שולח access_token ישן (חי שעה בלבד) → 401.
- אם הריענון נכשל — הקוד ממשיך עם ה-token הישן בלי להתריע.
- אין retry על 401 מגוגל.

**תיקון:**
- אם יש `refresh_token` — תמיד לרענן כשאין `expires_at` או שעבר תוקף, ולעדכן את הרשומה.
- לעטוף את הקריאה ל-GA: אם מחזירה 401 → לרענן פעם אחת ולנסות שוב.
- אם הריענון עצמו נכשל (`invalid_grant` / `invalid_client`) → להחזיר שגיאה ברורה: "החיבור לגוגל בוטל — נדרש חיבור מחדש", ולסמן את הרשומה ב-`tenant_integrations` (למשל `settings.needs_reauth = true`) כדי שה-UI יציג כפתור "חבר מחדש".
- להחיל את אותה לוגיקת refresh+retry גם על שאר הקריאות בקובץ (Daily / Reports נוספים אם יש).

## חלק 2 — סנכרון יומי אוטומטי

**Edge Function חדשה: `cron-sync-google-analytics`**
- רצה עם service role.
- שולפת את כל הרשומות מ-`tenant_integrations` שבהן `provider = 'google_analytics'` ו-`is_active = true` ויש `refresh_token` ב-settings.
- לכל רשומה: שולפת את ה-`property_id` השמור ומפעילה את `sync-google-analytics-data` עם טווח של 90 יום אחרונים (לפי כלל הזיכרון: GA syncs always pull at least 90 days).
- מטפלת בשגיאות פר-חיבור בלי להפיל את כל הריצה. רושמת תוצאה (success/failed + reason) ל-`integration_health` דרך `record_integration_result`.

**Cron Job (pg_cron):**
- שם: `daily-ga-sync`
- שעה: 06:00 בבוקר ישראל = 04:00 UTC, כלומר `0 4 * * *`.
- קורא ל-`cron-sync-google-analytics` עם anon key.
- ה-SQL ירוץ דרך `supabase--insert` (כמו שמתועד עבור cron) ולא דרך migration.

**הגדרת config.toml** ל-`cron-sync-google-analytics` עם `verify_jwt = false`.

## חלק 3 — UX לחיבור שפג

ב-`src/pages/GoogleAnalyticsSettings.tsx`:
- אם `settings.needs_reauth = true` → להציג באנר אדום על הכרטיס של אותו חשבון: "החיבור לגוגל בוטל — לחץ לחיבור מחדש" עם כפתור שמפעיל את אותו OAuth flow קיים. אחרי חיבור מוצלח, הדגל מתאפס.

## קבצים מושפעים
- `supabase/functions/sync-google-analytics-data/index.ts` (תיקון refresh + retry)
- `supabase/functions/cron-sync-google-analytics/index.ts` (חדש)
- `supabase/config.toml` (רישום הפונקציה החדשה אם נדרש)
- `src/pages/GoogleAnalyticsSettings.tsx` (באנר reauth)
- pg_cron schedule דרך insert SQL

## תוצאה צפויה
- כל בוקר ב-06:00 הנתונים של עידר ושאר הלקוחות עם GA יסתנכרנו אוטומטית ל-90 יום אחרונים.
- כשל זמני של token יתוקן אוטומטית ב-retry.
- רק אם המשתמש בעצמו ביטל את ההרשאה בגוגל — תוצג הודעה ברורה לחיבור מחדש (במקום שגיאה גנרית).
