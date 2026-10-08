-- Revert to simple SELECT policy for campaigners
DROP POLICY IF EXISTS "Owners can view all campaigners in their tenant" ON campaigners;

CREATE POLICY "Simple campaigners view policy"
ON campaigners FOR SELECT
USING (
  -- Super admin sees all
  is_super_admin(auth.uid())
  OR
  -- Users in same tenant can see campaigners
  tenant_id IN (
    SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
  )
);