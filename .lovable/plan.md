

## הבעיה

ההקלטות נשמרו בהצלחה בבסיס הנתונים (12 הקלטות), אבל מדיניות האבטחה (RLS) על טבלת `zoom_recordings` לא מאפשרת לך לראות אותן.

הבעיה: ה-SELECT policy משתמש ב-`get_user_tenant_id(auth.uid())` בלבד, בלי bypass ל-super admin. כ-super admin, הפונקציה הזו לא מחזירה את ה-tenant הנכון.

## תיקון

עדכון ה-RLS policies על `zoom_recordings` כדי לתמוך גם ב-super admin:

```sql
DROP POLICY "Users can view zoom recordings in their tenant" ON zoom_recordings;
CREATE POLICY "Users can view zoom recordings in their tenant" ON zoom_recordings
  FOR SELECT USING (
    tenant_id = get_user_tenant_id(auth.uid())
    OR is_super_admin(auth.uid())
  );
```

אותו דבר לכל שאר ה-policies (INSERT, UPDATE, DELETE).

