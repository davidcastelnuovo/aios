# תכנית: פרטי לקוח לפי ערוצים + טבלאות/דשבורד דינמיים בלחיצה

מטרה: בכל לקוח להגדיר את מזהי החשבונות לכל ערוץ (Google Ads, Meta Ads, Analytics,
Ahrefs/SEO, אתר, עמוד פייסבוק) — כאשר **מוצגים רק השדות של הערוצים שהלקוח מסומן בהם**.
לאחר ההגדרה, בלחיצת כפתור אחת מניהול הלקוח נפתחות ללקוח **טבלה דינמית לכל ערוץ + דשבורד
מאוחד**.

## מצב קיים (כבר בנוי — נשתמש מחדש)
**ניהול לקוחות**
- `clients.services` (text[]) = **סימון הערוצים**. ערכים: `ppc_google`, `ppc_meta`,
  `seo`, `social`, `full_social`, `social_meta`, `automation`.
- שדות חשבון קיימים: `clients.meta_ads_account_id`, `clients.google_ads_account_id`,
  `clients.website`. עמוד פייסבוק מקושר דרך `social_pages` (client_id + platform).
- עריכת שדות: `ClientConnectionsTab.tsx` (אתר + מזהי פרסום + social_pages),
  `EditClientDialog.tsx`, `AddClientForm.tsx`. דפוס שמירה: `supabase.from("clients").update(...)`.

**טבלאות דינמיות + דשבורד (בוגר)**
- טבלאות: `crm_tables` (עם `integration_type`, `client_id`, `integration_settings` jsonb),
  `crm_fields`, `crm_records`. דשבורד: `crm_dashboards` (dashboard_type='client').
- CRUD דרך edge function `crm-tables`. קישור ללקוח כבר קיים ב-`ClientTablesTab.tsx`
  (סינון לפי `client_id`), רינדור ב-`ClientReportPanel`/`ClientDashboardPanel`,
  צפייה מלאה ב-`DynamicTableView`.
- דיאלוגי יצירה קיימים לכל ערוץ: `FacebookTableDialog`, `GoogleAdsTableDialog`,
  `GoogleAnalyticsTableDialog`, `GoogleSearchConsoleTableDialog`, `AhrefsTableDialog`.
- פונקציות סנכרון קיימות: `sync-facebook-insights`, `sync-google-ads-data`,
  `sync-google-analytics-data`, `sync-google-search-console-data`, `sync-ahrefs-data`.

## פערים שצריך לבנות
1. אין שדות מזהה ל-Analytics ו-Ahrefs ברמת הלקוח (יש רק meta/google ads).
2. שדות החיבור מוצגים תמיד — אין תצוגה מותנית לפי `services`.
3. אין "מקור אמת" אחד שממפה ערוץ → שדות + integration_type + sync.
4. אין כפתור אחד שמקצה אוטומטית טבלאות + דשבורד ללקוח לפי הערוצים שלו.

---

## עיקרון מנחה (best practice): קונפיג ערוצים אחד
מקור אמת יחיד `src/config/clientChannels.ts` שממפה כל ערוץ:
```
service code (ב-clients.services)  →  {
  label, icon,
  accountFields: [{ key (עמודה ב-clients), label, placeholder, validate }],
  integrationType (ל-crm_tables),
  syncFunction,
  tableDialog/snapshot
}
```
הקונפיג הזה מזין גם את **התצוגה המותנית של השדות** וגם את **ההקצאה האוטומטית של הטבלאות**
— כך אין כפילות לוגיקה, והוספת ערוץ עתידי = שורה אחת בקונפיג.

## החלטות שאושרו
- **אחסון מזהים**: עמודות חדשות ב-`clients` (עקבי עם meta/google ads הקיימים).
- **Analytics (GA)**: שדה `ga_property_id` **מוצג תמיד** לכל לקוח (כמו האתר).
- **Search Console**: שדה `gsc_site_url` מוצג **רק** ללקוחות SEO.
- **Ahrefs**: שדה `ahrefs_domain` מוצג רק ללקוחות SEO.

## שלב 0 — DB (Supabase, פרויקט `zvoijyneresvkadpprel`)
- הוספת עמודות ל-`clients`:
  - `ga_property_id` (text) — Google Analytics (GA4 property) — תמיד.
  - `gsc_site_url` (text) — Search Console — רק SEO.
  - `ahrefs_domain` (text) — דומיין/פרויקט ל-Ahrefs — רק SEO.
  - (meta/google ads כבר קיימים; website קיים.)
- ללא שינוי סכמה לטבלאות הדינמיות — הן כבר תומכות בכל הנדרש.

## שלב 1 — פרטי לקוח עם תצוגה מותנית
- הרחבת `ClientConnectionsTab.tsx` (וגם השדות ב-EditClientDialog details + AddClientForm)
  כך שכל קבוצת שדות חיבור תוצג **רק אם** `client.services` כולל את הערוץ:
  - `ppc_google` → `google_ads_account_id`
  - `ppc_meta` → `meta_ads_account_id` + קישור עמוד פייסבוק (`social_pages`)
  - `seo` → `ahrefs_domain` + `gsc_site_url` (Search Console)
  - אתר (`website`) + Analytics (`ga_property_id`) — **תמיד מוצגים** לכל לקוח.
- מיפוי השדות מגיע מקונפיג הערוצים. שמירה בדפוס הקיים (`clients.update`).
- אינדיקציה ויזואלית: אם ערוץ מסומן אך חסר מזהה — תג "חסר חיבור".

## שלב 2 — כפתור "צור/פתח טבלאות + דשבורד" (אוטומציה אידמפוטנטית)
- כפתור בכותרת תצוגת הצ'אט של הלקוח (וגם בתפריט שורת הטבלה).
- בלחיצה, פונקציית `provision-client-channels` (edge function חדשה, או flow צד-לקוח שמשתמש
  ב-`crm-tables`):
  1. עבור כל ערוץ פעיל ב-`services` עם מזהה חשבון מוגדר:
     - לוודא שקיימת `crm_table` עם `integration_type` תואם + `client_id` (match אידמפוטנטי
       לפי client_id+integration_type — אם קיימת, לעדכן `integration_settings`; אחרת ליצור).
     - לאכלס `integration_settings` ממזהי הלקוח (account id / domain / property).
  2. לוודא `crm_dashboard` (dashboard_type='client') ללקוח שמאגד את הטבלאות.
  3. להפעיל סנכרון ראשוני לכל טבלה (קריאה לפונקציית ה-sync המתאימה).
  4. לדלג על ערוץ פעיל ללא מזהה ולהחזיר אזהרה ("Google PPC מסומן אך חסר account id").
- לאחר מכן פתיחת ה-`ClientTablesTab`/`DashboardView` של הלקוח עם הטאבים החדשים.

## שלב 3 — בדיקות והשקה
- מיגרציות עמודות דרך `apply_migration`.
- פריסת ה-edge function (אם נבחר) דרך `deploy-edge-function.yml`.
- בדיקה ידנית: לקוח עם seo+ppc_google → רואים רק את השדות הרלוונטיים → כפתור יוצר 2 טבלאות
  + דשבורד → סנכרון מציג נתונים.

## נקודות פתוחות / סיכונים
- **אידמפוטנטיות**: זיהוי טבלה קיימת לפי (client_id, integration_type) כדי לא לכפול.
- **הרשאות**: שדות פיננסיים/credentials כבר מאחורי `canViewFinance`; לשמור על אותו דפוס.
- **מזהים חסרים**: UX ברור כשמסמנים ערוץ בלי למלא מזהה.
- **provision לפי תמיד-מוצג**: Analytics (GA) ייווצר לכל לקוח עם `ga_property_id` מוגדר,
  ללא תלות ב-`services`; GSC/Ahrefs רק ללקוחות SEO.
