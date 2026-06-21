## מחיקת עמוד "דוחות WooCommerce"

זה עמוד `Reports.tsx` שנגיש מ־`/t/:tenantSlug/reports` ומופיע בסיידבר כ"דוחות". הוא נפרד מהטבלאות הדינמיות ומהדשבורדים של הלקוחות, ולכן מחיקתו לא משפיעה עליהם.

### שינויים
1. **`src/App.tsx`** — להסיר את ה־`lazy import` של `Reports` ואת ה־`<Route path="/t/:tenantSlug/reports" ...>`.
2. **`src/components/layout/AppSidebar.tsx`** — להסיר את פריט התפריט `{ key: "reports", label: "דוחות", route: "/reports" ... }`.
3. **`src/pages/Reports.tsx`** — מחיקת הקובץ.
4. בדיקה ש־`menu_items` בטבלת ה־DB לא תלויה במפתח `reports` בצורה שתשבור (אם קיים — נשאיר את ה־DB; פריט בלתי-קיים פשוט לא יוצג).

### מה לא נוגעים בו
- `DashboardView.tsx`, `SharedDashboard.tsx`, `WooCommerceDashboard.tsx`, `PublicWooCommerceView.tsx`, `DynamicTables` — כולם ממשיכים לעבוד.
- אין Edge Functions ייעודיים לעמוד הזה למחיקה.
