

## ההבנה שלי

המשתמש מתלונן: כעת הטאב "WooCommerce" וגם הכרטיס "הכנסות (WooCommerce)" בלשונית "הכל" מציגים **שניהם** ₪11,987 / 20 הזמנות (הם תואמים זה לזה). אבל זה **לא** המספר שמוצג ב־WooCommerce admin עצמו — שם מוצג ₪10,701 / 19 הזמנות (תמונה 289).

המשתמש אומר: "עשית הפוך — במקום לעדכן את המספר של 'הכל' לערך הנכון של WooCommerce (₪10,701), שינית את הטאב WooCommerce כך שיתאים ל'הכל' השגוי (₪11,987)."

## מה מצאתי בבדיקת DB

ל־4*4, הזמנות עם סטטוסים תקפים:
- Apr 12-18 (7 ימים שמסתיימים אתמול בשעון UTC): 19 הזמנות, סך ₪10,701 ✓ זה בדיוק מה ש־Woo admin מציג
- בקוד הנוכחי (אחרי התיקון האחרון שלי): הטווח מחושב לפי **חצות שעון ישראל** והופך ל־UTC. חצות 12 באפריל IL = `Apr 11 21:00 UTC`, ולכן הזמנה #14404 (`Apr 11 23:07 UTC` = `Apr 12 02:07 IL`) **נכנסת** לטווח. סך הכל ₪10,701 + ₪1,286 = **₪11,987 / 20 הזמנות** — בדיוק מה שמופיע במערכת.

**הבעיה**: אנחנו מסננים את `date_created` (UTC) מול תחילת/סוף יום בשעון מקומי שהומר ל־UTC. Woo admin מסנן לפי **תאריך החנות בשעון UTC** (או שעון החנות) ב־boundary של יום מלא ב־UTC, ולכן הזמנה אחת באמצע הלילה (UTC vs IL) יוצרת פער.

## התיקון

לשנות את כל חישובי ה־`getDateRange` של WooCommerce כך שיעבדו ב־**UTC** במקום בשעון מקומי. כלומר, "אתמול" = `00:00:00 UTC` של אתמול עד `23:59:59 UTC` של אתמול. כך הטווח יתאים בדיוק לחישוב של WooCommerce admin (Apr 12-18 UTC), ויוצא ₪10,701 / 19.

### קבצים שיתעדכנו

1. **`src/components/dynamic-tables/WooCommerceDashboard.tsx`** — `getDateRange` יעבוד ב־UTC (`Date.UTC(...)`).
2. **`src/pages/DashboardView.tsx`** — `wooDateRange` יעבוד גם הוא ב־UTC, כך שכרטיס "הכנסות (WooCommerce)" ב"הכל" יראה ₪10,701 / 19 — זהה לטאב WooCommerce ולגוגל.
3. **`src/pages/SharedDashboard.tsx`** — אם יש שם חישוב WooCommerce דומה, ליישר גם אותו.
4. **`supabase/functions/public-dashboard/index.ts`** — הטווח שהedge function מחזיר עבור הזמנות WooCommerce צריך גם הוא לעבוד ב־UTC.

### תוצאה צפויה אחרי התיקון

| מקום | לפני | אחרי |
|---|---|---|
| WooCommerce admin (חיצוני) | ₪10,701 / 19 | ₪10,701 / 19 |
| טאב "WooCommerce" (אצלנו) | ₪11,987 / 20 ❌ | ₪10,701 / 19 ✓ |
| כרטיס "הכנסות" בלשונית "הכל" | ₪11,987 / 20 ❌ | ₪10,701 / 19 ✓ |
| דשבורד ציבורי + צילום שנשלח ללקוח | ₪11,987 / 20 ❌ | ₪10,701 / 19 ✓ |

## פירוט טכני

ב־`getDateRange`, במקום:
```ts
const start = new Date(now);
start.setHours(0, 0, 0, 0);          // local midnight
start.setDate(start.getDate() - 7);
```
נחליף ב:
```ts
const startUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 7, 0, 0, 0));
const endUtc   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1, 23, 59, 59, 999));
```
זה יבטיח שהטווח חופף בדיוק ליום קלנדרי ב־UTC, כמו שמערכות e-commerce סטנדרטיות מחשבות.

זה משפיע **רק** על נתוני WooCommerce — לא משנה את הלוגיקה של Google Ads/Analytics/Facebook, שמחושבים בנפרד.

## פרסום מחדש

לאחר התיקון נדרש **לפרסם מחדש** כדי שהשינוי יחול גם ב־`after-lead.com` ובצילומי המסך שנשלחים ללקוח.
