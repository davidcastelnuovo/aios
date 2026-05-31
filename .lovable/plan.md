## הבעיה
משתמשים עם תפקיד `seo` (כמו עופר חייק) לא רואים שום לקוח. שתי סיבות:

1. **אין RLS policy** על `clients` שמתירה לתפקיד `seo` לקרוא — קיימות policies רק ל-owner, team_manager, campaigner, sales_person, super_admin.
2. **בפרונט (`Clients.tsx`)** משתמש SEO מסווג כ-`isRestrictedClientViewer` ורואה רק לקוחות שהוקצו אליו ב-`client_team` (אותה התנהגות כמו campaigner).

לקוח מסומן כ-"SEO" באמצעות `clients.services` (מערך הכולל `'seo'`) או `clients.is_seo_client = true`.

## הפתרון
משתמש SEO צריך לראות את **כל הלקוחות המתויגים SEO** ב-tenant הנוכחי (וב-cross-tenant agencies משותפות, בעקבות הדפוס הקיים), ולא רק כאלה שהוקצו אישית.

### 1. Migration — RLS policy חדשה על `public.clients`
```sql
CREATE POLICY "SEO users view SEO-tagged clients"
ON public.clients FOR SELECT
USING (
  has_role(auth.uid(), 'seo'::app_role)
  AND (
    is_seo_client = true
    OR services @> ARRAY['seo']::text[]
  )
  AND (
    tenant_id = get_user_tenant_id(auth.uid())
    OR user_has_cross_tenant_agency_access(auth.uid(), agency_id)
  )
);
```

### 2. עדכון `src/pages/Clients.tsx`
- להפריד בין `isCampaigner` ל-`isSeo` ב-`isRestrictedClientViewer` — לקמפיינר משאירים את ההתנהגות הקיימת (assigned only); ל-SEO משנים לסינון לפי תיוג.
- במקום שבו מסננים כעת `accessibleClients` ל-restricted viewer, להוסיף ענף חדש: אם `isSeo && !isOwner && !isSuperAdmin && !isTeamManager`, להציג את כל הלקוחות ש-`is_seo_client === true || services?.includes('seo')` (RLS כבר תבטיח שזה רק ה-tenant/שיתופים).

### 3. הערות
- הסינון בפרונט נשאר רשת ביטחון; ה-RLS היא ההגנה האמיתית.
- אם קיים גם תפריט/דף אחר בו SEO צריך לראות לקוחות אלה (לדוגמה דשבורד SEO), אטפל בו רק אם תבקש — כרגע התלונה היא על מסך הלקוחות.

## שאלת הבהרה
האם משתמשי SEO צריכים גם **לערוך** את הלקוחות המתויגים SEO (UPDATE), או רק לצפות? כרגע התוכנית מוסיפה הרשאת צפייה (SELECT) בלבד.