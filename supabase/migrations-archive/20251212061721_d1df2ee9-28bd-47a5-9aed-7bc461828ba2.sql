
-- Drop existing SELECT policies on crm_tables
DROP POLICY IF EXISTS "Users can view tables from shared agencies" ON crm_tables;
DROP POLICY IF EXISTS "Users can view tables in their tenant" ON crm_tables;

-- Create fixed SELECT policy that properly checks tenant isolation
CREATE POLICY "Users can view tables in their tenant" ON crm_tables
FOR SELECT USING (
  -- Super admins can see all
  is_super_admin(auth.uid())
  OR
  -- Users can see tables in their own tenant
  tenant_id = get_user_tenant_id(auth.uid())
);

-- Create separate policy for shared agencies with proper check
CREATE POLICY "Users can view tables from shared agencies" ON crm_tables
FOR SELECT USING (
  -- Only show tables from agencies that are explicitly shared with user's tenant
  agency_id IS NOT NULL 
  AND EXISTS (
    SELECT 1 FROM agency_tenant_access ata
    WHERE ata.agency_id = crm_tables.agency_id
    AND ata.accessing_tenant_id = get_user_tenant_id(auth.uid())
  )
);
