
## הבעיה

המשתמש בג.ג רואה ש:
1. **בחירת אתר ה-GSC לא נשמרת** — בדיקת ה-DB מראה ש-`linkedGscSiteUrl: sc-domain:ggds.co.il` נשמר נכון ברמת הטבלה, אבל ה-`client_sites` של ה-integration השני (שייך למשתמש אחר) ריק עבור ג.ג.
2. **הזיהוי האוטומטי לא מצליח להתאים** את `targetDomain=ggds.co.il` ל-`gg-ds.com` (שני דומיינים שונים בעלי אותו לקוח).

### שני באגים בקוד:

**באג #1 — Invalidation לא נכון:** `updateSiteMutation` (שורה 299) מבצע `invalidateQueries({ queryKey: ["gsc-integration"] })` בעוד ש-`useUserIntegrations` משתמש ב-`['user-integrations', tenantId, integrationType, userId]`. כתוצאה — ה-UI לא מתרענן אחרי שמירה.

**באג #2 (העיקרי) — RLS חוסם את העדכון:** מדיניות ה-RLS על `tenant_integrations` מאפשרת UPDATE רק אם `user_id = auth.uid()`. כשהמשתמש הנוכחי משתמש ב-integration ש**שותפה אליו** מבעלים אחר (שמופיע דרך `user_has_integration_access`), הוא יכול לקרוא אבל לא לעדכן את `client_sites`. השמירה נכשלת בשקט.

ב-ג.ג יש 2 חיבורי GSC: אחד של `bcd21d1c...` (שמור: `sc-domain:ggds.co.il`), ושני של `4d4de25a...` (ריק). תלוי באיזה משתמש מחובר — `useUserIntegrations` עלול להחזיר את החיבור השני, ולכן השמירה נכשלת.

## הפתרון

### 1. שמירה ברמת הטבלה כ-Source of Truth (לא ב-integration)

הקוד כבר תומך בזה דרך `linkedGscSiteUrl` ב-`crm_tables.integration_settings`. השינוי: **להעדיף את `linkedGscSiteUrl` לפני `client_sites`** של ה-integration.

ב-`SeoReportTabs.tsx` (שורות 277-286) — ה-prop `domain` כבר מועבר נכון: `savedGscSiteUrl || targetDomain`. צריך **גם להעביר את `savedGscSiteUrl` כ-`initialSiteUrl`** ל-`GscIntegration`, ולהשתמש בו כ-prefer source.

ב-`GscIntegration.tsx`:
- להוסיף prop `initialSiteUrl?: string`
- בחישוב `persistedSiteUrl` — להעדיף את `initialSiteUrl` (שמור על הטבלה) לפני `clientSites[clientId]`
- ב-`updateSiteMutation` — להמשיך לעדכן את `client_sites` (ל-cache טוב), **אבל לקרוא ל-`onSiteSelected(siteUrl)` תמיד**, גם אם ה-DB update נכשל מ-RLS. ה-callback ב-`SeoReportTabs` כבר שומר ל-`crm_tables.integration_settings.linkedGscSiteUrl` (שלמשתמש יש הרשאה לעדכן).

### 2. תיקון Invalidation Key

ב-`updateSiteMutation.onSuccess` להחליף:
```ts
queryClient.invalidateQueries({ queryKey: ["gsc-integration"] });
// ⬇️
queryClient.invalidateQueries({ queryKey: ["user-integrations"] });
```

### 3. טיפול בשגיאות ב-RLS

ב-`updateSiteMutation`:
- לעטוף את ה-update ב-try/catch
- אם נכשל (RLS) — לרשום `console.warn` אבל **לא לזרוק שגיאה**, כי ה-`onSiteSelected` יבצע את השמירה האמיתית ברמת הטבלה.

### 4. תיקון נתון נגרר עבור ג.ג

מאחר שה-`linkedGscSiteUrl` כבר נכון (`sc-domain:ggds.co.il`), אחרי התיקון — הדשבורד יציג מיד את הדומיין הנכון בלי תלות באיזה integration נטענה.

## קבצים שיתעדכנו

- `src/components/dynamic-tables/seo/GscIntegration.tsx` — prop חדש `initialSiteUrl`, prefer-order, fix invalidation key, swallow RLS errors.
- `src/components/dynamic-tables/SeoReportTabs.tsx` — להעביר `initialSiteUrl={savedGscSiteUrl}` ל-`GscIntegration`.

## תוצאה

- **שמירת בחירת אתר תעבוד גם כשה-integration משותף** — נשמר ברמת ה-SEO table (שלמשתמש תמיד יש הרשאה).
- **ג.ג יציג את `ggds.co.il`** מיד אחרי הטעינה (כי כבר שמור ב-`linkedGscSiteUrl`).
- **ה-UI יתרענן נכון** אחרי שמירה ידנית.
