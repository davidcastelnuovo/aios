-- תיקון: מאפשר לowners ולteam_managers לנהל את כל התגיות בארגון

-- 1. מחיקת ה-policy הקיים
DROP POLICY IF EXISTS "Users can manage their own contact tags" ON chat_contact_tags;

-- 2. יצירת policy חדש שמאפשר לowners ולמנהלים לנהל את כל התגיות בארגון
CREATE POLICY "Users and admins can manage contact tags"
  ON chat_contact_tags
  FOR ALL
  USING (
    user_id = auth.uid()
    OR (
      tenant_id = get_user_tenant_id(auth.uid())
      AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'agency_owner') OR has_role(auth.uid(), 'team_manager'))
    )
    OR is_super_admin(auth.uid())
  )
  WITH CHECK (
    tenant_id = get_user_tenant_id(auth.uid())
    OR is_super_admin(auth.uid())
  );