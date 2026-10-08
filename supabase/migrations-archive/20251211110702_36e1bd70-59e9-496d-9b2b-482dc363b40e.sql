-- Drop existing policy
DROP POLICY IF EXISTS "Users can view tables in their scope" ON crm_tables;

-- Create new policy - super_admin sees only based on active tenant
CREATE POLICY "Users can view tables in their scope" ON crm_tables
FOR SELECT USING (
  -- All users (including super_admin) see only from their active tenant
  (tenant_id = get_user_tenant_id(auth.uid()))
  AND (
    -- Owners see everything in tenant
    has_role(auth.uid(), 'owner')
    OR is_super_admin(auth.uid())
    -- Or table without agency_id
    OR agency_id IS NULL
    -- Or agency from current tenant
    OR agency_id IN (SELECT id FROM agencies WHERE tenant_id = get_user_tenant_id(auth.uid()))
  )
  -- Also allow cross-tenant access to shared agencies
  OR (agency_id IS NOT NULL AND user_has_cross_tenant_agency_access(auth.uid(), agency_id))
);