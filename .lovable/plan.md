## הבעיה

הילה (campaigner) לא מצליחה ליצור טבלת Facebook ללקוח שמשויך אליה. המקור הוא ב-RLS של `crm_tables`: יש רק שתי policies לפעולות כתיבה — `Owners can manage all tables in tenant` ו-`Team managers can manage their tables`. אין שום policy שמתירה ל-`campaigner` לבצע INSERT/UPDATE/DELETE, ולכן כל ניסיון יצירה נכשל ב-RLS (גם דרך ה-edge function `crm-tables`, שרץ עם ה-JWT של המשתמש ולא service role).

מצד שני:
- האינטגרציה עצמה (`tenant_integrations` של פייסבוק) מוגדרת ל-tenant ו-`get-facebook-ad-accounts` משתמשת ב-service role לשליפת הטוקן — כלומר אין מניעה לקמפיינר להשתמש בחיבור הפייסבוק הקיים בארגון, גם אם הוא לא הבעלים שלו. הבדיקה הקדמית בדיאלוג של "האם פייסבוק מחובר?" כבר עוברת לקמפיינר דרך policy הצפייה (`user_is_tenant_member`).
- הקוד ב-`DynamicTables.tsx` כבר מעביר `assignedClientIds` לכל דיאלוגי היצירה כשמדובר בקמפיינר, וה-`FacebookTableDialog`/`SimpleTableDialog` כבר מסננים בהתאם.

לכן התיקון הוא בעיקר ב-RLS, עם תיקון UX קטן בדיאלוג.

## תוכנית התיקון

### 1. מיגרציה: הוספת RLS policy לקמפיינרים על `crm_tables`

הוספת policy ALL (INSERT/UPDATE/DELETE/SELECT) ל-`crm_tables` שמתירה לקמפיינר לפעול אך ורק על טבלאות ששויכו ללקוח שמופיע ב-`get_user_client_ids(auth.uid())`, באותו tenant של המשתמש:

```sql
CREATE POLICY "Campaigners can manage tables for assigned clients"
ON public.crm_tables
FOR ALL
TO authenticated
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND has_role(auth.uid(), 'campaigner'::app_role)
  AND client_id IS NOT NULL
  AND client_id = ANY(get_user_client_ids(auth.uid()))
)
WITH CHECK (
  tenant_id = get_user_tenant_id(auth.uid())
  AND has_role(auth.uid(), 'campaigner'::app_role)
  AND client_id IS NOT NULL
  AND client_id = ANY(get_user_client_ids(auth.uid()))
);
```

הגבלות מובנות:
- חובה `client_id` — קמפיינר לא יכול ליצור טבלה "כללית לסוכנות" או לטנאנט.
- ה-`client_id` חייב להיות אחד מהלקוחות המשויכים אליו דרך `client_team`.
- הטבלה חייבת להיות באותו tenant של הקמפיינר.
- super_admin/owner/team_manager ממשיכים לעבוד דרך ה-policies הקיימות.

### 2. תיקון UX קטן ב-`FacebookTableDialog.tsx`

כאשר `assignedClientIds` מועבר (כלומר המשתמש הוא קמפיינר רגיל) — לחייב בחירת לקוח לפני שמירה (כיום שדה הלקוח אופציונלי, וה-RLS החדש יחסום שמירה ללא `client_id`):

- אם `assignedClientIds` מוגדר ו-`clientId` ריק → הצג toast שגיאה "יש לבחור לקוח" ומנע שליחה.
- שינוי הליבל מ-"שיוך ללקוח (אופציונלי)" ל-"שיוך ללקוח" כאשר חובה.

ליישם את אותה הבדיקה גם ב-`SimpleTableDialog.tsx` (וביתר דיאלוגי האינטגרציות שמקבלים `assignedClientIds`: Google Ads, GSC, GA, Facebook E-commerce, Ahrefs, SEO Report) כדי להמנע מ-RLS errors מבלבלים.

### 3. בדיקה שאין צורך בשינוי בצד ה-edge functions

- `crm-tables` POST: עובר עם JWT של המשתמש ⇒ ה-policy החדש יאפשר את ה-INSERT.
- `get-facebook-ad-accounts` ו-`sync-facebook-insights`: כבר משתמשות ב-service role לשליפת הטוקן, אז קמפיינר משתמש בחיבור פייסבוק של הארגון ללא תלות בבעלות עליו.

## פירוט טכני (לסיכום)

**קבצים שישתנו:**
- `supabase/migrations/<new>.sql` — הוספת policy `Campaigners can manage tables for assigned clients` ל-`crm_tables`.
- `src/components/dynamic-tables/FacebookTableDialog.tsx` — אכיפת בחירת לקוח כשהמשתמש קמפיינר.
- `src/components/dynamic-tables/SimpleTableDialog.tsx` — אותו תיקון.
- `src/components/dynamic-tables/GoogleAdsTableDialog.tsx`, `GoogleSearchConsoleTableDialog.tsx`, `GoogleAnalyticsTableDialog.tsx`, `FacebookEcommerceTableDialog.tsx`, `AhrefsTableDialog.tsx`, `SeoReportDialog.tsx` — אותו תיקון UX (חובת לקוח לקמפיינר).

**לא משתנה:**
- חוקי ה-RLS של owners/team_managers/super_admin.
- Edge functions של פייסבוק/גוגל — כבר מטפלות נכון בגישה לטוקן.
- מודל ההרשאות לאינטגרציות (`tenant_integrations`).

## תוצאה צפויה

הילה (וכל קמפיינר אחר) תוכל ליצור טבלת Facebook (וכל טבלת אינטגרציה אחרת) עבור לקוח שמשויך אליה, באמצעות חיבור הפייסבוק הקיים של הארגון, ללא צורך בהרשאות נוספות. ניסיון ליצור טבלה ללא שיוך ללקוח, או ללקוח שלא משויך לקמפיינר, ימשיך להיחסם.
