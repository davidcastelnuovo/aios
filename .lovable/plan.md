

## הבעיה
הקישור הציבורי של טבלאות Google Ads (וכן Facebook) לא תמיד תואם לסוג הטבלה. כיום הלוגיקה ב-`SharedTable.tsx` מנסה לסווג אוטומטית קמפיינים כ-leads או ecommerce לפי הנתונים, מה שגורם לתצוגה מעורבת או לא נכונה. המשתמש רוצה: **סוג הטבלה קובע הכל** — טבלת לידים → תצוגת לידים בלבד; טבלת איקומרס → תצוגת איקומרס בלבד.

## הלוגיקה המתוקנת
ב-`src/pages/SharedTable.tsx`, נחליף את הסיווג האוטומטי בקביעה דטרמיניסטית מתוך מטא-דאטה של הטבלה:

```ts
const tableMode: 'leads' | 'ecommerce' =
  integrationType === 'facebook_ecommerce' ? 'ecommerce' :
  integrationType === 'facebook_insights' ? 'leads' :
  integrationType === 'google_ads'
    ? (tableCampaignType === 'ecommerce' ? 'ecommerce' : 'leads')
    : 'leads';

const forceLeadsOnly = tableMode === 'leads';
const forceEcommerceOnly = tableMode === 'ecommerce';
```

## השינויים בפועל

### `src/pages/SharedTable.tsx`
1. **שורות 119-122** — להחליף את החישוב הנוכחי של `forceLeadsOnly`/`forceEcommerceOnly` בלוגיקה החדשה לעיל המשלבת `integration_type` + `campaign_type`.
2. **שורות 213-225 (`campaignSummary`)** — להסיר את ה-fallback של הסיווג האוטומטי. עכשיו תמיד יחזיר `{ ecommerce: allCampaigns, leads: [] }` או להפך, לפי `tableMode`. אין יותר תצוגה מעורבת.
3. **שורות 175-176 (summary)** — `hasEcommerce`/`hasLeads` יקבעו ישירות לפי `tableMode` ולא לפי תוכן הנתונים.
4. **כרטיסי KPI (שורות 386-451)** — הלוגיקה כבר תלויה ב-`forceLeadsOnly`, אז תיתן תוצאה נכונה אוטומטית כי הדגלים מחושבים נכון.
5. **טבלאות קמפיינים (שורות 456 ו-521)** — אחת מהן תיהיה תמיד ריקה לפי המצב, כך שתוצג רק זו הרלוונטית.

## תוצאה
- **טבלת `facebook_insights`** → תמיד תצוגת לידים (לידים, קליקים, CPL).
- **טבלת `facebook_ecommerce`** → תמיד תצוגת איקומרס (הכנסות, רכישות, ROAS).
- **טבלת `google_ads` עם `campaign_type=ecommerce`** → תצוגת איקומרס.
- **טבלת `google_ads` עם `campaign_type=leads`** (ברירת מחדל) → תצוגת לידים — בדיוק כמו טבלת אקו.

## היקף
- קובץ אחד: `src/pages/SharedTable.tsx`.
- ללא שינויי DB, ללא Edge Functions.
- **חובה לפרסם מחדש** את האפליקציה כדי שהשינוי ישתקף ב-`after-lead.com`.

