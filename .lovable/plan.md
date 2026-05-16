
## הבעיה: ניפוח של ×3 ברכישות מול Facebook Ads Manager

איימי רואה ב־Ads Manager (לפי הצילום שצירפת):
- 7 ימים אחרונים (9.5–15.5): **9 Website purchases**, **₪108.18** עלות לרכישה, **₪973.58** הוצאה.

אצלנו ב־DB לאותם 7 ימים נשמרו רכישות: `9+0+12+3+3+0+0 = 27` — בדיוק פי 3 מהמספר האמיתי.

### השורש בבאג

ב־`supabase/functions/sync-facebook-insights/index.ts`, שורות 236–240:

```ts
const attributionWindows = encodeURIComponent(JSON.stringify(['7d_click', '1d_view']));
const insightsUrl = `...&action_attribution_windows=${attributionWindows}&use_unified_attribution_setting=true...`;
```

הצירוף הזה גורם לפייסבוק להחזיר את `value` של כל פעולה כסכום של שני חלונות ה־attribution — מה שמכפיל רכישות (וגם לידים) פי 2 או 3 לעומת ה־Ads Manager UI שמראה את ה־unified בלבד.

## התיקון

### `supabase/functions/sync-facebook-insights/index.ts`

1. **להסיר את `action_attribution_windows` מה־URL לחלוטין**, ולהשאיר `use_unified_attribution_setting=true` בלבד.
   זה גורם לפייסבוק להחזיר את הערכים בדיוק לפי הגדרת ה־unified attribution של החשבון — אותם מספרים שמופיעים ב־UI של Ads Manager.

2. **שמירה על קוד הספירה הקיים** (`getActionCount`, `pickFirstAvailable` עם `omni_purchase` כראשון). הוא נכון; הבעיה הייתה רק בערך שמגיע מ־FB.

3. **לוג קצר** שמדפיס לכל קמפיין: `purchases (from omni_purchase / fb_pixel_purchase / purchase)` כדי שנדע מאיזה action_type נספרו — לעזרה בדיבוג עתידי.

### תצוגה בטבלת איקומרס (התיקון מהבקשה הקודמת נשמר)

ב־`src/pages/DynamicTableView.tsx`, עבור טבלת ה־ecommerce — אם בכל הנתונים `purchase_value === 0` ו־`add_to_cart === 0`:
- העמודות יהיו: קמפיין | חשיפות | קליקים | הוצאה | **רכישות** | **עלות לרכישה** (`spend/purchases`).
- ללא ROAS, ללא ערך רכישות, ללא הוספות לעגלה.

לקוחות שיש להם ערך רכישה או add_to_cart > 0 — ימשיכו לראות את הטבלה המלאה עם ROAS, בדיוק כמו היום.

## מה לעשות אחרי הדפלוי

1. דפלוי של `sync-facebook-insights`.
2. ללחוץ "סנכרן Facebook" בדף של איימי — זה ירוץ מחדש על כל הטווח וידרוס את הרשומות הקיימות עם הערכים הנכונים.
3. הטבלה תציג: **9 רכישות, ₪108 עלות לרכישה, ₪974 הוצאה** — בדיוק כמו ב־Ads Manager.

## למה זה לא ישבר ללקוחות אחרים

- הסרת `action_attribution_windows` רק *תקרב* את המספרים שלנו ל־UI של פייסבוק. כל לקוח שמסתכל היום על המספרים שלנו מקבל מספר מנופח ×2/×3 ביחס למה שהוא רואה ב־Ads Manager — התיקון יישר את כולם.
- שינוי תצוגת טבלת איקומרס הוא דינמי לפי הנתונים (`purchase_value === 0 && add_to_cart === 0`) ולא משפיע על לקוחות שיש להם ערכי רכישה.
- אין שינוי בסכמת ה־DB.
