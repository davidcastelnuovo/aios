## הבעיה
ה-Google Ads סובל מאותם ליקויים שתיקנתי ב-Google Analytics:

1. **`sync-google-ads-data`** — הריענון של ה-token פשטני: בודק רק `expires_at < now()` *לפני* הקריאה, לא מנסה להתאושש מ-401 בזמן ריצה, ולא מסמן את החיבור כ-`needs_reauth` כשגוגל מחזירה `invalid_grant` (refresh_token שפג / בוטל).
2. **`google-ads-auth` → `refreshIntegrationToken`** — אותה בעיה: שגיאת רענון רק נרשמת ל-log, החיבור נשאר `is_active=true` והמשתמש לא רואה שצריך לחבר מחדש.
3. **`GoogleAdsSettings.tsx`** — אין באנר/אינדיקציה שהחיבור פג, אין כפתור "חבר מחדש".
4. **אין cron אוטומטי** ל-Google Ads (יש `cron-sync-google-ads` כפונקציה אבל צריך לוודא שיש pg_cron מתוזמן).

## התיקון

### 1. `supabase/functions/sync-google-ads-data/index.ts`
- שיפור `refreshToken`: כשהתשובה מגוגל מכילה `error === 'invalid_grant'` (או כל שגיאה לא-זמנית) — לעדכן את ה-integration עם `is_active=false` ו-`settings.needs_reauth=true` + `last_error`.
- להוסיף retry: אם קריאת Google Ads API מחזירה 401, להריץ `refreshToken` פעם אחת ולנסות שוב לפני ויתור.
- להחזיר תגובה ברורה (`{ error: 'needs_reauth' }`) שה-UI יוכל לזהות.

### 2. `supabase/functions/google-ads-auth/index.ts`
- ב-`refreshAccessToken` וב-`refreshIntegrationToken`: על `invalid_grant` לסמן `needs_reauth=true`, `is_active=false` ולשמור `last_error`.

### 3. `src/pages/GoogleAdsSettings.tsx`
- להוסיף באנר אדום ברור כשהחיבור במצב `needs_reauth` או `is_active=false`, עם כפתור "חבר מחדש" שמפעיל מחדש את זרימת ה-OAuth (כמו שעשינו ב-GA).
- לזהות שגיאת `needs_reauth` שחוזרת מהסנכרון ולהציג טוסט מתאים.

### 4. תזמון אוטומטי
- לוודא קיום pg_cron job יומי שמפעיל את `cron-sync-google-ads` (להריץ באותה שעה כמו GA — 06:00 שעון ישראל / 04:00 UTC), אם עדיין לא קיים. אם קיים — לוודא שהוא תקין.
- לוודא ש-`cron-sync-google-ads` עוברת על כל ה-integrations הפעילים ומריצה `sync-google-ads-data` לכל טבלת Google Ads, וכשהיא מקבלת `needs_reauth` — מסמנת ולא מנסה שוב עד תיקון.

## תוצאה צפויה
- כשה-refresh_token של גוגל מתבטל, הסנכרון מפסיק לכשול בשקט והמשתמש רואה באנר "חבר מחדש" בדף ההגדרות.
- אחרי לחיצה על "חבר מחדש" — OAuth חדש, `needs_reauth=false`, `is_active=true`, והסנכרון חוזר לעבוד אוטומטית כל בוקר.