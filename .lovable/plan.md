## הבעיה

עמוד "הנהלת חשבונות" לא מציג את 31 הלקוחות של סוכנות **DMM-MC** כשמסתכלים מתוך ארגון **MarketingCaptain**.

### למה זה קורה

הסוכנות DMM-MC מוגדרת כסוכנות משותפת בין MarketingCaptain ל-DMM (קיימת רשומה ב-`agency_tenant_access`). אבל הלקוחות שלה (31 רשומות) נשמרים עם `tenant_id = DMM`, ולא עם `tenant_id = MarketingCaptain`.

ה-query הנוכחי בעמוד מסנן באופן נוקשה:
```ts
.eq("tenant_id", currentTenantId)
```

זה מחזיר רק את 7 הלקוחות עם `tenant_id = MC`, ומסנן החוצה את 31 הלקוחות שהועברו ל-DMM למרות שהסוכנות עדיין משותפת עם MC.

זה בדיוק התרחיש שעבורו קיים ההוק `useCrossTenantAgencyIds` — שמשמש כבר ב-Dashboard, AhrefsSettings, TeamChat ועוד.

## התיקון

### `src/pages/AccountingIntegrations.tsx`

1. **לייבא ולהשתמש ב-`useCrossTenantAgencyIds`** כדי לקבל את רשימת הסוכנויות המשותפות.

2. **`accounting-clients` query** — להחליף את `.eq("tenant_id", currentTenantId)` ב-`.or(...)` שמכליל גם את הסוכנויות המשותפות:
   ```ts
   const orFilter = `tenant_id.eq.${currentTenantId},agency_id.in.(${crossTenantAgencyIds.join(',')})`;
   query = query.or(orFilter);
   ```
   (אם אין סוכנויות חוצות-ארגון — נשארים עם `.eq` הפשוט.)

3. **`agencies` dropdown query** — להוסיף גם את הסוכנויות המשותפות (`agency_id IN crossTenantAgencyIds`) כדי שיופיעו ברשימת הסינון.

4. **`accounting-suppliers` query** — נשאר tenant-scoped (ספקים הם נכס פנימי של הארגון, וזה הגיוני).

5. **`one_time_incomes` ו-`client_tenant_financial_data`** — נשארים tenant-scoped כפי שהם (אלו רשומות פיננסיות של MC לאותם לקוחות, וזה התנהגות נכונה).

6. **תלות `queryKey`** — להוסיף את `crossTenantAgencyIds` כדי שה-cache יתעדכן כשמשתנה.

### בדיקות אבטחה

מדיניות ה-RLS על `clients` כבר מתירה `SELECT` חוצה-ארגון דרך `user_has_cross_tenant_agency_access` (זה מה שמאפשר ל-Dashboard לעבוד היום), אז לא נדרש שינוי במסד הנתונים.

## תוצאה צפויה

לאחר התיקון, צפייה בעמוד "הנהלת חשבונות" מתוך MarketingCaptain תציג גם את 7 הלקוחות הישירים וגם את 31 הלקוחות של DMM-MC המשותפת — סך הכל 38 לקוחות (כפוף לפילטרים סטטוס/סוכנות/חיפוש).
