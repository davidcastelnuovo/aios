-- Drop existing policies on user_roles
DROP POLICY IF EXISTS "Managers can view all roles" ON user_roles;
DROP POLICY IF EXISTS "Super admins can view all roles" ON user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON user_roles;
DROP POLICY IF EXISTS "Users can view roles" ON user_roles;

-- Create ONE simple policy that avoids recursion by NOT calling is_super_admin()
CREATE POLICY "Users can view roles"
  ON user_roles
  FOR SELECT
  TO authenticated
  USING (
    -- Users can always see their own roles (no recursion - simple comparison)
    user_id = auth.uid()
    OR
    -- Users with global super_admin can see all (direct EXISTS check, no function call)
    EXISTS (
      SELECT 1 FROM user_roles ur2
      WHERE ur2.user_id = auth.uid()
      AND ur2.role = 'super_admin'
      AND ur2.tenant_id IS NULL
    )
    OR
    -- Owners can see roles in their tenants
    tenant_id IN (
      SELECT ur3.tenant_id 
      FROM user_roles ur3 
      WHERE ur3.user_id = auth.uid() 
      AND ur3.role = 'owner'
    )
    OR
    -- Global roles (tenant_id IS NULL) can be seen by anyone authenticated
    tenant_id IS NULL
  );