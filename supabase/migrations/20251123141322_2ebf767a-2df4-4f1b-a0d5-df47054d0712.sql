
-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Owners can manage campaigner_agencies" ON campaigner_agencies;

-- Create a new policy that allows team_manager, owner, and super_admin
CREATE POLICY "Team managers and owners can manage campaigner_agencies"
ON campaigner_agencies
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'team_manager'::app_role) 
  OR has_role(auth.uid(), 'owner'::app_role) 
  OR is_super_admin(auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'team_manager'::app_role) 
  OR has_role(auth.uid(), 'owner'::app_role) 
  OR is_super_admin(auth.uid())
);
