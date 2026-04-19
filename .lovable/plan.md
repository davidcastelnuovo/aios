
## הבעיה (שתי נפרדות)

### בעיה 1: דשבורד הלקוח (DashboardView, האפליקציה הפרטית)
ב-`DashboardView` כרטיס "הכנסות" מציג **WooCommerce** כשמחובר אתר, **אבל** הסכום שונה מטאב ה-WooCommerce:
- כרטיס "הכנסות (WooCommerce)" משתמש ב-`wooSummary` שמסונן לפי `wooDateRange` (טווח שמסתיים אתמול)
- טאב "WooCommerce" משתמש ב-`PublicWooCommerceView` שמקבל את כל ההזמנות ש-`public-dashboard` מחזיר (טווח שמסתיים **היום** ב-edge function — לא תוקן)
- → לכן הסכום ב"הכל" נמוך מהסכום בטאב WooCommerce (אם יש הזמנות מהיום) או להפך

### בעיה 2: צילום המסך (ClientDashboardSnapshot) — מוצג בפאנל שליחת דשבורד
הצילום מרנדר את `SharedDashboard.tsx` (לא את `DashboardView`). וב-`SharedDashboard`:
- כרטיס "הכנסות (Analytics)" משתמש ב-`totalSummary.revenue` שזה **רק GA**, ואינו לוקח בחשבון WooCommerce בכלל
- אין שם `wooSummary` כמו ב-DashboardView
- → לכן הצילום שנשלח ללקוח מציג מספר אחר ממה שהמשתמש רואה ב-DashboardView הפנימי

נוסף לכך, פונקציית ה-edge `public-dashboard` מסננת WooCommerce orders לפי טווח שמסתיים **היום** (כולל היום), בעוד `DashboardView.wooSummary` מסתיים אתמול.

## התיקון

### A. ליישר את `SharedDashboard.tsx` עם `DashboardView.tsx`
1. להוסיף ל-`SharedDashboard` חישוב `wooSummary` (revenue + orders) על בסיס `wooOrders` שכבר מגיע מה-edge function — באמצעות סינון `validStatuses` זהה (`completed`, `processing`, `on-hold`).
2. להוסיף לכרטיס "הכנסות" את אותה לוגיקה: אם `revenueWoo > 0` → מציגים אותו ומציינים "(WooCommerce)"; אחרת → GA.
3. אופציונלית להוסיף את הערת ההשוואה ל-GA כמו ב-DashboardView.

### B. ליישר את הטווח ב-`public-dashboard` edge function
- לעדכן את `getDateRange` כך ש-`last_7_days`, `last_30_days`, `last_70_days` יסתיימו **אתמול** (`today - 1`), בדיוק כמו `crm-records` ו-`DashboardView.wooDateRange`.
- זה מבטיח שהן הזמנות WooCommerce (שמסוננות לפי `date_created` מול `startDate`/`endDate`) והן רשומות ה-CRM יסונכרנו לאותו טווח.

### C. לוודא שהטווח הפנימי ב-`DashboardView` תואם לטאב WooCommerce
- `PublicWooCommerceView` (שמשמש בטאב) פשוט מסכם את כל ההזמנות שקיבל — אם נתקן את `public-dashboard` (B), גם הטאב יציג בדיוק את אותו מספר ככרטיס "הכנסות".

## קבצים שיתעדכנו
- `supabase/functions/public-dashboard/index.ts` — תיקון `getDateRange` כך שיסתיים אתמול לטווחים יחסיים.
- `src/pages/SharedDashboard.tsx` — חישוב `wooSummary` (revenue+orders) וטעימה בכרטיס "הכנסות" שמעדיף Woo על GA.
- ללא שינוי DB, ללא שינוי בסנכרון.

## מה לא נוגעים
- הטאב WooCommerce עצמו (`PublicWooCommerceView`, `WooCommerceDashboard`) — נשאר כפי שהוא, רק מקבל נתונים נכונים.
- `DashboardView.tsx` — הלוגיקה כבר נכונה, התיקון ב-edge function ייישר את הטאב לכרטיס.

## פרסום מחדש
לאחר התיקון נדרש **לפרסם מחדש** כדי שהדשבורד הציבורי ב-`after-lead.com` והצילום של פאנל "שליחת דשבורד" יציגו את אותם מספרים בדיוק.
