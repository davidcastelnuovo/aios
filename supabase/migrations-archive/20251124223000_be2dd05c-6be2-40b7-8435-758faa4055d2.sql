-- Fix INSERT policy for campaigners - properly check tenant_id
DROP POLICY IF EXISTS "Team managers and owners can insert campaigners" ON campaigners;

CREATE POLICY "Team managers and owners can insert campaigners"
ON campaigners FOR INSERT
WITH CHECK (
  is_super_admin(auth.uid()) 
  OR tenant_id IN (
    SELECT ur.tenant_id 
    FROM user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('owner', 'team_manager')
  )
);