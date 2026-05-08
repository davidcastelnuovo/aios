# תיקון חזרה מאינטגרציות + עמוד 404

## הבעיה

1. **עמוד 404** מציג כפתור "חזרה לדשבורד" — צריך להוביל לעמוד הבית (`/t/:slug/home`) ולא לדשבורד.
2. **לאחר חיבור אינטגרציה** (Google Ads / Analytics / Search Console / וכו') המשתמש מועבר ל-404. הסיבה: ה-Edge Function של ה-OAuth callback בונה את ה-redirect הסופי מתוך `Deno.env.get('APP_URL')` (או fallback ל-`https://lovable.dev`), ולא מתוך הדומיין שממנו המשתמש התחיל את החיבור. כתוצאה מכך הוא נופל לדומיין הלא נכון (preview / published / custom domain) → הנתיב לא קיים שם → 404.

## הפתרון

### 1. עמוד 404 (`src/pages/NotFound.tsx`)
- שינוי הכפתור מ-"חזרה לדשבורד" → "חזרה לעמוד הבית".
- ה-href יבנה דרך `buildPath("home")` במקום `buildPath("dashboard")`.
- אם ה-tenant לא מוכן עדיין, fallback ל-`/` (לא ל-`/auth`), כדי ש-Home Router הראשי יבחר את היעד הנכון.

### 2. החזרת אורח מקור ה-OAuth ב-`state`
כדי שלא יקרה שוב 404 אחרי OAuth, נעביר את ה-origin של הדומיין הנוכחי כחלק מ-`state`, וב-callback נשתמש בו במקום `APP_URL`.

**Frontend** (איפה שמריצים `getAuthUrl`/קוראים לפונקציה):
- `src/pages/GoogleAdsSettings.tsx`
- `src/pages/GoogleAnalyticsSettings.tsx`
- `src/pages/GoogleSearchConsoleSettings.tsx`
- `src/pages/GmailSettings.tsx`
- `src/pages/FacebookSettings.tsx` (כבר מעביר `redirectUri` מלא, רק לוודא שהיעד הוא `integrations` ולא דף ספציפי)

נעביר בכל קריאה גם `origin: window.location.origin` (ולפעמים גם `return_to: window.location.pathname` כדי לחזור לעמוד ההגדרות הספציפי).

**Edge Functions שצריכות עדכון** — אריזה של `origin` ב-state וקריאתו ב-callback:
- `supabase/functions/google-ads-auth/index.ts`
- `supabase/functions/google-analytics-auth/index.ts`
- `supabase/functions/google-search-console-auth/index.ts`
- `supabase/functions/gmail-auth/index.ts`
- `supabase/functions/google-calendar-auth/index.ts`

לוגיקת ה-redirect ב-callback תהפוך ל:
```
const base = stateOrigin || Deno.env.get('APP_URL') || 'https://after-lead.com';
const redirectUrl = `${base}/t/${tenantSlug}/integrations?<provider>=connected`;
```
ובמסלול השגיאה — אותו דבר, רק עם `?error=...`.

`facebook-auth` כבר מעביר `frontend_n` מהפרונט ולכן ימשיך לעבוד אחרי שנוודא שה-`redirectUri` בפרונט מצביע על `/t/:slug/integrations` (היום מצביע ל-`/t/:slug/facebook-callback` — נחליף ל-`integrations` כדי להיות עקביים, או נשאיר כפי שהוא אם דף ה-callback הזה תקין; נבחן בזמן ביצוע).

### 3. ניקוי טכני קטן
- בכל ה-redirect ב-callbacks להחליף את ה-fallback `'https://lovable.dev'` ל-`'https://after-lead.com'` (הדומיין האמיתי של האפליקציה).

## קבצים שיתעדכנו
- `src/pages/NotFound.tsx`
- `src/pages/GoogleAdsSettings.tsx`, `GoogleAnalyticsSettings.tsx`, `GoogleSearchConsoleSettings.tsx`, `GmailSettings.tsx`, `FacebookSettings.tsx`
- `supabase/functions/google-ads-auth/index.ts`
- `supabase/functions/google-analytics-auth/index.ts`
- `supabase/functions/google-search-console-auth/index.ts`
- `supabase/functions/gmail-auth/index.ts`
- `supabase/functions/google-calendar-auth/index.ts`

## מה לא ישתנה
- אין שינוי בהגדרות OAuth ב-Google Cloud / Facebook (ה-`redirect_uri` הקבוע אל ה-Edge Function נשאר זהה).
- אין שינוי בלוגיקת השמירה של ה-tokens.
- אין שינוי ב-RLS / DB.
