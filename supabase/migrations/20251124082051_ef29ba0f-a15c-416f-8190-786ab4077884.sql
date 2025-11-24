
-- Drop the problematic policy
DROP POLICY IF EXISTS "Team managers and owners can manage campaigner_agencies in their tenant" ON campaigner_agencies;

-- Create updated policy that handles both owned and shared agencies
CREATE POLICY "Team managers and owners can manage campaigner_agencies"
ON campaigner_agencies
FOR ALL
TO authenticated
USING (
  -- Check that the user has the right role
  (has_role(auth.uid(), 'team_manager'::app_role) OR has_role(auth.uid(), 'owner'::app_role))
  AND (
    -- Campaigner must belong to user's tenant
    EXISTS (
      SELECT 1 FROM campaigners c
      WHERE c.id = campaigner_agencies.campaigner_id
      AND c.tenant_id = get_user_tenant_id(auth.uid())
    )
    -- Agency must be either owned or shared with user's tenant
    AND (
      EXISTS (
        SELECT 1 FROM agencies a
        WHERE a.id = campaigner_agencies.agency_id
        AND a.tenant_id = get_user_tenant_id(auth.uid())
      )
      OR user_has_cross_tenant_agency_access(auth.uid(), campaigner_agencies.agency_id)
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
    AND (
      EXISTS (
        SELECT 1 FROM agencies a
        WHERE a.id = campaigner_agencies.agency_id
        AND a.tenant_id = get_user_tenant_id(auth.uid())
      )
      OR user_has_cross_tenant_agency_access(auth.uid(), campaigner_agencies.agency_id)
    )
  )
  OR is_super_admin(auth.uid())
);
