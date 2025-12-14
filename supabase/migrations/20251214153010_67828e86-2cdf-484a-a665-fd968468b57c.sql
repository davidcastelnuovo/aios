-- Drop the existing SELECT policy that's too restrictive
DROP POLICY IF EXISTS "Users can view their permissions" ON integration_user_permissions;

-- Create a new policy that allows users to see permissions granted TO them
CREATE POLICY "Users can view their own granted permissions"
ON integration_user_permissions
FOR SELECT
USING (
  user_id = auth.uid()  -- Can see permissions granted to yourself
  OR is_super_admin(auth.uid())  -- Super admins can see all
  OR EXISTS (
    SELECT 1 FROM tenant_integrations ti
    WHERE ti.id = integration_user_permissions.integration_id
    AND ti.user_id = auth.uid()  -- Integration owner can see who has permissions
  )
);