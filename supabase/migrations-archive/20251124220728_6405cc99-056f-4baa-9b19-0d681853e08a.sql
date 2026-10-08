
-- Fix tasks SELECT RLS policy to properly handle shared agencies
-- The issue: can_access_agency returns false for shared agencies
-- Solution: Add explicit check for shared agencies in the policy

DROP POLICY IF EXISTS "Users can view tasks from accessible agencies" ON tasks;

CREATE POLICY "Users can view tasks from accessible agencies"
ON tasks
FOR SELECT
TO authenticated
USING (
  is_super_admin(auth.uid())
  OR
  -- Tasks in my own tenant
  (tenant_id = get_user_tenant_id(auth.uid()))
  OR
  -- Tasks from agencies shared with my tenant
  (
    agency_id IN (
      SELECT ata.agency_id
      FROM agency_tenant_access ata
      WHERE ata.accessing_tenant_id = get_user_tenant_id(auth.uid())
    )
  )
);
