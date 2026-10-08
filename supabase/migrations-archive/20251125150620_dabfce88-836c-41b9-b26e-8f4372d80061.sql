-- Fix UPDATE policy for tasks - check if user belongs to task's tenant, not just active tenant
DROP POLICY IF EXISTS "Users can update tasks in accessible agencies" ON tasks;

CREATE POLICY "Users can update tasks in accessible agencies"
ON tasks FOR UPDATE
USING (
  is_super_admin(auth.uid())
  OR
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
  OR
  agency_id IN (
    SELECT agency_id FROM agency_tenant_access
    WHERE accessing_tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
  )
)
WITH CHECK (
  is_super_admin(auth.uid())
  OR
  (
    tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
    AND (
      agency_id IN (
        SELECT id FROM agencies 
        WHERE tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
      )
      OR
      agency_id IN (
        SELECT agency_id FROM agency_tenant_access
        WHERE accessing_tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
      )
    )
  )
);