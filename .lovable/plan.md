# תיקון הצגת טבלאות חוצות-ארגון ב-Dynamic Tables

## הבעיה
טבלת Google Ads חדשה ("פ.ד פסגות") נוצרה היום, שויכה לסוכנות MarketingCaptain וללקוח, אך לא מופיעה ברשימה.

**שורש הבעיה:** הטבלה נשמרה עם `tenant_id` = `Promo` (ה-tenant הפעיל בעת היצירה), אך הסוכנות `MarketingCaptain` שייכת ל-tenant `marketingcaptain`. ב-`supabase/functions/crm-tables/index.ts` GET מחזיר רק:
1. טבלאות עם `tenant_id` של המשתמש
2. טבלאות מסוכנויות זרות ב-`agency_tenant_access`

אין טיפול במקרה ההפוך — טבלה שנוצרה ב-tenant אחר אך משויכת ל**סוכנות שבבעלות ה-tenant הנוכחי**.

## הפתרון

### 1. `supabase/functions/crm-tables/index.ts` (GET)
להוסיף שאילתה שלישית: למשוך את כל ה-`agency.id` של הסוכנויות בבעלות ה-tenant הנוכחי, ולהביא טבלאות עם `tenant_id != currentTenant AND agency_id IN (ownedAgencyIds)`. למזג עם התוצאות הקיימות תוך הימנעות מכפילויות (Set לפי id).

```text
ownTenantTables  ∪  sharedAgencyTables  ∪  ownedAgencyForeignTables
```

מבנה:
- שאילתה 1 (קיימת): `tenant_id = currentTenant`
- שאילתה 2 (קיימת): `tenant_id != currentTenant AND agency_id IN sharedAgencyIds`
- שאילתה 3 (חדשה): `tenant_id != currentTenant AND agency_id IN ownedAgencyIds`
  (`ownedAgencyIds` = `SELECT id FROM agencies WHERE tenant_id = currentTenant`)

לאחר השינוי לדפלוי את הפונקציה (אוטומטי).

### 2. ולידציה ב-POST (מניעת הישנות)
לוודא ב-POST שגם אם המשתמש שולח `agency_id` ששייך ל-tenant אחר, ה-`tenant_id` של הטבלה יישמר כ-`tenant_id` של **הסוכנות** (אם קיימת), ולא של היוצר. זה ימנע כפילויות עתידיות ויבטיח שכל טבלה "שייכת" לארגון של הסוכנות שלה.

לוגיקה:
```
if (agency_id) {
  const ownerTenantId = SELECT tenant_id FROM agencies WHERE id = agency_id
  insert with tenant_id = ownerTenantId
} else {
  insert with tenant_id = creatorTenantId (קיים)
}
```

### 3. תיקון נתונים קיים (מיגרציה חד-פעמית)
לעדכן את כל הטבלאות הקיימות שבהן `crm_tables.tenant_id` שונה מ-`agencies.tenant_id` של הסוכנות המשויכת, כך שיתאימו:

```sql
UPDATE crm_tables ct
SET tenant_id = a.tenant_id
FROM agencies a
WHERE ct.agency_id = a.id
  AND ct.tenant_id IS DISTINCT FROM a.tenant_id;
```

זה יחזיר מיידית את הטבלה "פ.ד פסגות" ל-tenant הנכון (marketingcaptain), ואת המשתמש יראה אותה ללא תלות בתיקוני ה-GET.

### 4. RLS
הטבלה `crm_tables` כבר מאפשרת קריאה לפי tenant_id ולפי גישה לסוכנות. לוודא שה-policies תומכות בקריאה גם דרך owned agency (אם לא — להוסיף policy).

## קבצים שיושפעו
- `supabase/functions/crm-tables/index.ts` (GET + POST)
- מיגרציה חדשה לתיקון נתונים קיימים + בדיקת/הוספת RLS policy
