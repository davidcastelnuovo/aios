

## הבעיה

קישור השיתוף של אקו (Google Ads, מוגדר כ-`campaign_type: 'leads'`) מציג כרטיסי **eCommerce** ("הכנסות", "רכישות", "ROAS") וטבלת **"קמפייני איקומרס"**, במקום תצוגת לידים נקייה.

### למה זה קורה
בדקתי את הנתונים בפועל בטבלת אקו - כל 90 הרשומות מכילות:
- `cost`, `conversions`, `conversions_value` (שדות סטנדרטיים של Google Ads)
- אין כלל `spend`, `leads`, `purchases`, `purchase_value`, `add_to_cart`, או שדה `campaign_type` ברשומה

ב-`SharedTable.tsx`:
- `getRevenueFromData` קורא את `conversions_value` ומחשיב כ-**revenue**
- חלק מהרשומות יש להן `conversions_value: 1` (ערך זניח)
- זה מפעיל `summary.hasEcommerce = true` → מוצגים כרטיסי eCommerce
- בנוסף, `campaignSummary.ecommerce` מסווג קמפיינים עם `revenue > 0` כ-eCommerce → מוצגת טבלת "קמפייני איקומרס"

**הקריטי**: ההגדרה `integration_settings.campaign_type = 'leads'` של הטבלה **מתעלמים ממנה לחלוטין** ב-SharedTable. ב-`DynamicTableView.tsx` (הדוח הפנימי) זה כבר תוקן (שורות 2427-2428: `forceLeadsOnly`), אבל לא הועתק ל-Shared.

## התיקון

### `src/pages/SharedTable.tsx`

**1. כיבוד הגדרת `campaign_type` של הטבלה כמקור האמת**

להוסיף helper בראש הקומפוננטה:
```ts
const tableCampaignType = String((data?.table?.integration_settings as any)?.campaign_type || '').toLowerCase();
const forceLeadsOnly = tableCampaignType === 'leads' || tableCampaignType === 'lead';
const forceEcommerceOnly = tableCampaignType === 'ecommerce';
```

**2. ב-`summary` (שורות 128-158)** – לכבד את `forceLeadsOnly`:
- אם `forceLeadsOnly`: לאפס `purchases`, `revenue`, `addToCart` ולוודא `hasEcommerce = false`
- אם `forceEcommerceOnly`: לאפס `leads` ולוודא `hasLeads = false`
- בנוסף, להחמיר את `getLeadsFromData` עבור Google Ads כך שלא ייספר `conversions_value` כ-revenue כשהטבלה מוגדרת leads.

**3. ב-`campaignSummary` (שורות 161-194)** – להחיל את אותה לוגיקה כמו ב-DynamicTableView:
```ts
const ecommerceCampaigns = forceLeadsOnly ? [] : allCampaigns.filter(...);
const leadCampaigns = forceLeadsOnly ? allCampaigns : (forceEcommerceOnly ? [] : allCampaigns.filter(...));
```

**4. כותרות עמודות בטבלת לידים** – להוסיף את העמודה "המרות" (conversions) ל-Google Ads בנוסף ל"לידים", כי בעולם של Google Ads המונח השגור הוא "המרות" ולא "לידים". וגם להציג עיגול לספרה שלמה כמו שעשינו בדוח הפנימי.

### תוצאה צפויה

קישור השיתוף של אקו (`after-lead.com/shared/table/...`) יציג:
- כרטיסי סיכום: **הוצאה כוללת**, **המרות**, **קליקים**, **CPL** (ללא Revenue/Purchases/ROAS)
- טבלה אחת בלבד: **"קמפייני לידים"** עם כל ארבעת הקמפיינים (Pmax, אנטארקטיקה, מדגסקר, אינדונזיה)
- אין יותר טבלת "קמפייני איקומרס"
- ערכי המרות מעוגלים (10 במקום 9.6, 24 במקום 23.5)
- מטבע בדולר ($) – כפי שכבר תוקן

### היקף השינוי
- קובץ אחד בלבד: `src/pages/SharedTable.tsx`
- ללא שינויי DB, ללא שינויי edge functions
- אין השפעה על טבלאות אחרות: טבלאות eCommerce ימשיכו לעבוד (כי `campaign_type === 'ecommerce'` או `integration_type === 'facebook_ecommerce'`)

