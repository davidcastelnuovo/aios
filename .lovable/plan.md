## תיקון עמודות שינוי דירוגים בקישור שיתוף Dashboard

הקישור הציבורי של ה-Dashboard מציג את `PublicSeoView` ללא נתוני ההשוואה ההיסטוריים מ-GSC, ולכן עמודות "שינוי חודשי / 3 חודשים / שנתי" לא מופיעות — בדיוק כמו הבאג שתוקן בקישור שיתוף של דוח SEO.

הפתרון: שכפול אותה לוגיקה (`gsc_multi_period`) מ-`public-table` אל `public-dashboard`, והעברתה ל-`PublicSeoView`.

### שינויים

**1. `supabase/functions/public-dashboard/index.ts`** (Edge Function — נפרס אוטומטית)
- אחרי הבלוק הקיים של GSC, להוסיף בלוק זהה לזה שב-`public-table` (שורות 429-533):
  - לקחת את `seoLinkedGscSiteUrl` (כבר קיים) או `gscTable.integration_settings.siteUrl` כ-`effectiveGscSiteUrl`.
  - לשלוף `tenant_integrations` של GSC, לרענן access token דרך `GOOGLE_CLIENT_ID/SECRET` במידת הצורך.
  - להריץ במקביל `fetchPeriod` עבור prevMonth (58→30 ימים), threeMonth (118→90), yearly (393→365).
  - להחזיר `gsc_multi_period: { prevMonth, threeMonth, yearly }` בתוך ה-response JSON.

**2. `src/pages/SharedDashboard.tsx`** (Frontend — דורש Publish→Update)
- לקרוא `const gscMultiPeriod = data?.gsc_multi_period || null;` באזור של `seoGscRecords`.
- להוסיף `gscMultiPeriod={gscMultiPeriod}` לשני המקומות שמרנדרים `<PublicSeoView ... />` (שורות ~751 ו-~774).

### בדיקה
- לפתוח את קישור ה-Dashboard המשותף ולוודא שעמודות "שינוי חודשי / 3 חודשים / שנתי" מופיעות עם חיצים ירוק/אדום, בדיוק כמו בדוח ה-SEO המשותף.

### הערה למשתמש
שינוי ה-Frontend ב-`SharedDashboard.tsx` ידרוש לחיצה על **Publish → Update** כדי להופיע בקישור הלייב. שינוי ה-Edge Function נפרס מיד אוטומטית.