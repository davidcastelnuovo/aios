-- Drop the existing policy on campaigner_agencies
DROP POLICY IF EXISTS "Team managers and owners can manage campaigner_agencies" ON campaigner_agencies;

-- Create a new policy that checks tenant_id for both campaigner and agency
CREATE POLICY "Team managers and owners can manage campaigner_agencies in their tenant"
ON campaigner_agencies
FOR ALL
TO authenticated
USING (
  -- Check that the user has the right role
  (has_role(auth.uid(), 'team_manager'::app_role) OR has_role(auth.uid(), 'owner'::app_role))
  AND (
    -- And that both the campaigner and agency belong to their tenant
    EXISTS (
      SELECT 1 FROM campaigners c
      WHERE c.id = campaigner_agencies.campaigner_id
      AND c.tenant_id = get_user_tenant_id(auth.uid())
    )
    AND EXISTS (
      SELECT 1 FROM agencies a
      WHERE a.id = campaigner_agencies.agency_id
      AND a.tenant_id = get_user_tenant_id(auth.uid())
    )
  )
  -- Or the user is a super admin
  OR is_super_admin(auth.uid())
)
WITH CHECK (
  -- Same check for INSERT/UPDATE
  (has_role(auth.uid(), 'team_manager'::app_role) OR has_role(auth.uid(), 'owner'::app_role))
  AND (
    EXISTS (
      SELECT 1 FROM campaigners c
      WHERE c.id = campaigner_agencies.campaigner_id
      AND c.tenant_id = get_user_tenant_id(auth.uid())
    )
    AND EXISTS (
      SELECT 1 FROM agencies a
      WHERE a.id = campaigner_agencies.agency_id
      AND a.tenant_id = get_user_tenant_id(auth.uid())
    )
  )
  OR is_super_admin(auth.uid())
);