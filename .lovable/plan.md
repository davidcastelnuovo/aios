

## תיקון: ביטויי Search Console נטענים אוטומטית בדוח SEO המרכזי

### הבעיה
בקישור הציבורי GSC נטען אוטומטית כי `public-table` רץ עם service-role ובוחר אינטגרציית GSC כלשהי בטננט שמותאמת לאתר. בדוח הפנימי (`SeoDashboardView` → `GscIntegration`) משתמשים ב-`useUserIntegrations` שמחזיר **רק** אינטגרציות בבעלות המשתמש המחובר או ששותפו אליו במפורש דרך `integration_user_permissions`.

מצב נוכחי לדורון לוין:
- בטננט `MarketingCaptain` יש אינטגרציית GSC של **David** עם מיפוי תקין `cb3d38ec... → https://www.dl-cpa.co.il/`
- ויש גם אינטגרציה של **אנה** ללא מיפוי
- כל משתמש אחר → `gscIntegrations = []` → אין `gscIntegration` → אין fetch → אין ביטויים בטבלה המרכזית עד שמסנכרנים ידנית.

### הפתרון
הוספת מנגנון fallback פנימי שכאשר אין למשתמש אינטגרציה משלו/משותפת, המערכת תזהה אוטומטית אינטגרציית GSC פעילה בטננט שיש לה את ה-`siteUrl` המתאים ללקוח — ותשתמש בה לקריאות `fetch-gsc-data` (שכבר רצה עם service-role ולא דורשת בעלות).

#### 1. Edge Function חדשה: `resolve-seo-gsc-integration`
קלט: `{ clientId, tenantIds: string[], expectedSiteUrl?: string }`
לוגיקה (service-role):
1. שולפת את כל אינטגרציות `google_search_console` הפעילות בכל ה-tenants הנגישים.
2. סדר עדיפות:
   - אינטגרציה שבה `settings.client_sites[clientId]` מוגדר ושווה ל-`expectedSiteUrl` (אם נמסר) או לפחות לא ריק.
   - אינטגרציה שב-`settings.available_sites` יש את ה-`expectedSiteUrl` עם `permissionLevel != 'siteUnverifiedUser'`.
   - אינטגרציה ראשונה שיש לה כל מיפוי תקין כלשהו ל-`clientId`.
   - אינטגרציה פעילה כלשהי (fallback אחרון).
3. מחזירה `{ integrationId, siteUrl, ownerEmail }` — לא חושפת tokens.

#### 2. Hook חדש: `useResolvedGscIntegration`
```ts
useResolvedGscIntegration({ clientId, tenantIds, savedSiteUrl })
→ { integrationId, siteUrl, isFallback, isLoading }
```
- מנסה קודם `useUserIntegrations` (אינטגרציה אישית/משותפת).
- אם אין → קורא ל-`resolve-seo-gsc-integration` ומחזיר את ה-fallback.

#### 3. עדכון `GscIntegration.tsx`
- מקבל prop אופציונלי: `resolvedFallback?: { integrationId, siteUrl }`.
- אם `useUserIntegrations` ריק והגיע fallback — משתמש ב-`resolvedFallback.integrationId` ב-queries של `fetch-gsc-data` ובמסלול של `gsc-multi-period`.
- מציג Badge קטן: "GSC משותף בארגון" (ללא חסימה, ללא כפתור "חבר GSC" כשיש fallback).
- ה-`updateSiteMutation` (כתיבה ל-`tenant_integrations`) **לא** ירוץ במצב fallback (כדי לא להיכשל ב-RLS) — ה-site URL נשמר ברמת ה-table דרך `onSiteSelected` שכבר עובד.

#### 4. עדכון `SeoDashboardView.tsx`
- קורא ל-`useResolvedGscIntegration` ומעביר את ה-`resolvedFallback` ל-`GscIntegration`.
- מעביר את `initialGscSiteUrl` כ-`expectedSiteUrl` ל-resolver.

### מה לא משתנה
- `useUserIntegrations` ללא שינוי — עדיפות לאינטגרציה אישית של המשתמש.
- אין שינויי RLS, אין מיגרציות.
- `public-table` (קישור שיתוף) — לא נוגעים, ממשיך לעבוד כמו עכשיו.
- שאר הלקוחות (Berliner, Woodhill וכו') — הלוגיקה הקיימת ממשיכה לעבוד; ה-fallback מופעל רק כש-`useUserIntegrations` ריק.
- מסלולים אחרים (Ahrefs, GA, פילטר תאריכים, comparison cache, language filter) — ללא נגיעה.
- כל משתמש שיחבר GSC משלו ימשיך לראות את האינטגרציה האישית (עדיפות גבוהה יותר).

### בדיקות
1. דורון לוין → `/t/marketingcaptain/table/seo-report-...` → ביטויי GSC מופיעים אוטומטית בטבלת הביטויים המרכזית, ליד ביטויי Ahrefs, ללא לחיצה על "סנכרון".
2. דוחות SEO אחרים שכבר עובדים → ללא רגרסיה.
3. משתמש שחיבר GSC משלו → רואה את האינטגרציה האישית (לא fallback), Badge "GSC משותף" לא מופיע.
4. קישור השיתוף הציבורי `dvrvn-7r67` → ממשיך לעבוד ללא שינוי.

### קבצים
- `supabase/functions/resolve-seo-gsc-integration/index.ts` (חדש)
- `src/hooks/useResolvedGscIntegration.ts` (חדש)
- `src/components/dynamic-tables/seo/GscIntegration.tsx` (תוספת prop ולוגיקת fallback)
- `src/components/dynamic-tables/SeoDashboardView.tsx` (העברת ה-fallback)

