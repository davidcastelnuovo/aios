
-- Drop the existing INSERT policy
DROP POLICY IF EXISTS "Team managers can insert campaigners in their tenant" ON campaigners;

-- Create a more permissive INSERT policy
CREATE POLICY "Team managers and owners can insert campaigners"
ON campaigners
FOR INSERT
TO authenticated
WITH CHECK (
  (tenant_id = get_user_tenant_id(auth.uid()) AND (
    has_role(auth.uid(), 'team_manager'::app_role) 
    OR has_role(auth.uid(), 'owner'::app_role)
  ))
  OR is_super_admin(auth.uid())
);
