
-- Fix campaigners INSERT policy to check role in the specific tenant being inserted
DROP POLICY IF EXISTS "Team managers and owners can insert campaigners" ON campaigners;

CREATE POLICY "Team managers and owners can insert campaigners"
ON campaigners
FOR INSERT
TO authenticated
WITH CHECK (
  -- Check if user has owner or team_manager role in the specific tenant
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.tenant_id = tenant_id
    AND ur.role IN ('owner', 'team_manager')
  )
  OR is_super_admin(auth.uid())
);

-- Also fix the UPDATE policy for consistency
DROP POLICY IF EXISTS "Users can update campaigners in their tenant" ON campaigners;

CREATE POLICY "Users can update campaigners in their tenant"
ON campaigners
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.tenant_id = campaigners.tenant_id
    AND ur.role IN ('owner', 'team_manager')
  )
  OR is_super_admin(auth.uid())
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.tenant_id = tenant_id
    AND ur.role IN ('owner', 'team_manager')
  )
  OR is_super_admin(auth.uid())
);

-- Also fix DELETE policy
DROP POLICY IF EXISTS "Users can delete campaigners in their tenant" ON campaigners;

CREATE POLICY "Users can delete campaigners in their tenant"
ON campaigners
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.tenant_id = campaigners.tenant_id
    AND ur.role IN ('owner', 'team_manager')
  )
  OR is_super_admin(auth.uid())
);
