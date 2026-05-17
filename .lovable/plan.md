## הבעיה

ב־30 הימים האחרונים בקמפיין של אדמה חיה (לידים בדף נחיתה):
- **Facebook Ads Manager**: 233 לידים
- **המערכת שלנו (UI)**: 193 לידים
- **ה־DB שלנו**: 235 לידים (תואם ל־FB ✓)

הסנכרון תקין. הבעיה היא בתצוגה.

## שורש הבאג

`src/lib/adsMetrics.ts` — הפונקציה `getLeadsFromData` שמשמשת בכל ה־UI (DynamicTableView, DashboardView, SharedTable, SharedDashboard) מעדיפה את הערך מ־`form_leads` *לפני* השדה `leads`:

```ts
export const getLeadsFromData = (data: any) =>
  getFacebookFormLeadsFromData(data) ||   // ← קודם form_leads (188)
  Number(data?.leads) ||                   // ← רק כ־fallback (235)
  ...
```

בדף נחיתה של אדמה חיה, פייסבוק מחזיר גם `leadgen_grouped` (טופס לידים) וגם `offsite_conversion.fb_pixel_lead` (לידים מהאתר). הסנכרון כבר אוסף נכון את שניהם לתוך השדה `leads` (לפי לוגיקת `_isLeadFormObjective` ב־`sync-facebook-insights/index.ts` שורות 337–342), אבל ה־UI דורס את זה ומציג רק את ה־form leads.

## התיקון

ב־`src/lib/adsMetrics.ts`:

```ts
export const getLeadsFromData = (data: any) =>
  Number(data?.leads) ||                   // ← השדה האוטוריטטיבי שהאדג'-פאנקשן חישב
  getFacebookFormLeadsFromData(data) ||
  Number(data?.conversions) ||
  Number(data?.website_leads) ||
  Number(data?.offsite_conversion) ||
  Number(data?.offsite_conversion_fb_pixel_lead) ||
  0;
```

זהו שינוי של שורה אחת — להזיז את `Number(data?.leads)` לראש שרשרת ה־fallback.

`getExplicitLeadFieldsFromData` נשארת כמו שהיא (משמשת בלוח מחוונים לפילוח לפי פלטפורמה — שם לא רוצים את האגרגט).

## מה זה משנה

- אדמה חיה (30 יום): UI יציג **235** במקום 193 → תואם ל־FB.
- לקוחות אחרים שיש להם רק `form_leads` ולא `leads` (קמפיין טופס בלבד) — לא ישתנו, כי `Number(data?.leads)` יהיה 0 ויפול ל־`getFacebookFormLeadsFromData`.
- לקוחות עם רק `leads` (כל הקמפיינים הלא־טפסיים) — לא ישתנו, כבר עבדו דרך ה־fallback.

## איפה צריך לשנות

קובץ אחד בלבד: `src/lib/adsMetrics.ts` — שורה 24–32.

לא נדרש re-sync — הנתונים ב־DB כבר נכונים.
