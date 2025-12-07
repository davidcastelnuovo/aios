-- Drop existing policy
DROP POLICY IF EXISTS "Owners can view all roles" ON user_roles;

-- Create simple policy: managers can view all roles in their tenant
CREATE POLICY "Managers can view all roles"
  ON user_roles
  FOR SELECT
  TO authenticated
  USING (
    -- Users can always see their own roles
    user_id = auth.uid()
    OR
    -- Super admins see everything
    is_super_admin(auth.uid())
    OR
    -- Owners and team managers can see roles in their tenant
    (
      tenant_id IN (
        SELECT ur.tenant_id 
        FROM user_roles ur 
        WHERE ur.user_id = auth.uid() 
        AND ur.role IN ('owner', 'team_manager')
      )
      OR tenant_id IS NULL
    )
  );