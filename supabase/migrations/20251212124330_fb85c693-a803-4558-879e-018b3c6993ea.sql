-- Fix campaigners RLS policy to only show campaigners from active tenant
DROP POLICY IF EXISTS "Simple campaigners view policy" ON campaigners;

CREATE POLICY "Users can view campaigners in their active tenant"
ON campaigners
FOR SELECT
USING (
  is_super_admin(auth.uid()) 
  OR tenant_id = get_user_tenant_id(auth.uid())
);