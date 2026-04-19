

## הבעיה
בדשבורד של "ארבע על ארבע" (לקוח promo), טבלת המקור היא **Google Ads ecommerce** (`integration_settings.campaign_type = 'ecommerce'`), אבל הלשונית **Google Ads בדשבורד** מציגה תמיד מטריקות של לידים:
- כרטיסי KPI: "המרות 4", "עלות להמרה ₪163"
- טבלת קמפיינים: עמודות "המרות" ו"עלות להמרה" בלבד

זה לא תואם לסוג הטבלה הראשית (אקומרס) — ולכן חסר: **הכנסות, רכישות, ROAS, AOV**.

## איפה התיקון
שני קבצים שמפרסמים את אותו תוכן (פנימי + ציבורי):
1. `src/pages/DashboardView.tsx` (שורות 728–765, 1316–1430)
2. `src/pages/SharedDashboard.tsx` (שורות 453–492, 867–980)

לוגיקת הזיהוי `getCampaignType` שכבר קיימת:
```ts
if (integrationType === 'google_ads')
  return integrationSettings?.campaign_type === 'ecommerce' ? 'ecommerce' : 'leads';
```
היא נכונה, היא פשוט **לא בשימוש** ברינדור של לשונית Google Ads.

## מה ישתנה

### שלב 1 — זיהוי סוג הקמפיין של Google Ads בדשבורד
חישוב חדש (מעל `googleAdsCampaignSummary`):
```ts
const googleAdsCampaignType: 'leads' | 'ecommerce' = useMemo(() => {
  const gaTables = tables.filter((t: any) => t.integration_type === 'google_ads');
  if (gaTables.some((t: any) => t.integration_settings?.campaign_type === 'ecommerce')) {
    return 'ecommerce';
  }
  return 'leads';
}, [tables]);
```
זה מסתמך **רק על הגדרת הטבלה** — לא על ניחוש מהדאטה — בדיוק כמו שביקשת בעבר ("סוג הטבלה קובע הכל").

### שלב 2 — רינדור מותנה של כרטיסי KPI
- אם `googleAdsCampaignType === 'ecommerce'`:
  - 5 כרטיסים: **הוצאה כוללת · חשיפות · קליקים · רכישות · הכנסות · ROAS** (6 — או נחליף את "חשיפות" ב-AOV כדי להישאר על 5)
  - "רכישות" = `conversions` מהקמפיין
  - "הכנסות" = `conversions_value`
  - "ROAS" = `conversions_value / spend`
- אחרת (כיום): כרטיסי לידים כמו שיש היום (המרות + עלות להמרה).

### שלב 3 — רינדור מותנה של טבלת קמפיינים
- במצב `ecommerce`: עמודות = קמפיין · חשיפות · קליקים · CTR · CPC · הוצאה · **רכישות · הכנסות · ROAS · AOV**
- במצב `leads` (קיים היום): קמפיין · חשיפות · קליקים · CTR · CPC · הוצאה · המרות · עלות להמרה

הנתונים כבר נשלפים: `googleAdsCampaignSummary` מחזיר כבר `conversions` ו-`conversions_value` לכל קמפיין — צריך רק להחליף את התצוגה.

### שלב 4 — שכפול ל-`SharedDashboard.tsx`
אותה לוגיקה בדיוק (אותם קוד ושמות משתנים) — הציבורי משקף את הפנימי.

## מה לא ישתנה (חשוב לא לשבור!)
- **לשונית "הכל"** ולוגיקת `campaignTypeByPlatform` נשארות כמו שהן (כבר תומכות ב-ecommerce).
- **Facebook Ads** — לוגיקה נפרדת, לא נוגעים.
- **Analytics / SEO / WooCommerce** — לא משתנים.
- **טבלת הראשית (`SharedTable.tsx`)** — לא נוגעים, אישרת אותה כבר.
- אם הטבלה היא `leads` (ברירת מחדל) — הדשבורד יציג את אותה תצוגה כמו היום, אפס שינוי ויזואלי.

## פירוט טכני (לבעלי עניין)
- אין שינוי DB, אין Edge Functions, אין שינוי ב-sync.
- שינוי הוא תצוגתי בלבד — שני קבצי דשבורד.
- הסנכרון של Google Ads כבר שומר `conversions_value` ב-`crm_records.data`, אז כל הנתונים זמינים.

## דרוש פרסום מחדש
כדי שהדשבורד הציבורי ב-`after-lead.com` יציג את הלוגיקה החדשה, יש **לפרסם מחדש** אחרי השינוי.

