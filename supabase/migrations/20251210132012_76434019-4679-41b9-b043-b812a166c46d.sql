-- Drop existing SELECT policies on crm_tables
DROP POLICY IF EXISTS "Users can view tables in their tenant" ON crm_tables;
DROP POLICY IF EXISTS "Users can view tables from shared agencies" ON crm_tables;
DROP POLICY IF EXISTS "Owners can view tables in accessible agencies" ON crm_tables;

-- Create new SELECT policy that properly filters by agency access
CREATE POLICY "Users can view tables in accessible scope"
ON crm_tables FOR SELECT
USING (
  is_super_admin(auth.uid())
  OR
  (
    -- User's tenant matches table's tenant
    tenant_id = get_user_tenant_id(auth.uid())
    AND
    (
      -- General tables (no agency) - always visible within tenant
      agency_id IS NULL
      OR
      -- Tables with agency - agency must be in user's tenant
      EXISTS (
        SELECT 1 FROM agencies a
        WHERE a.id = crm_tables.agency_id
        AND a.tenant_id = get_user_tenant_id(auth.uid())
      )
    )
  )
  OR
  (
    -- Tables from shared agencies (cross-tenant)
    agency_id IS NOT NULL 
    AND user_has_cross_tenant_agency_access(auth.uid(), agency_id)
  )
);