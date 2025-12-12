
-- Drop all existing SELECT policies on crm_tables
DROP POLICY IF EXISTS "Users can view tables in their tenant" ON public.crm_tables;
DROP POLICY IF EXISTS "Users can view tables in their scope" ON public.crm_tables;
DROP POLICY IF EXISTS "Users can view tables from shared agencies" ON public.crm_tables;

-- Create a single clear SELECT policy
-- Users see tables that:
-- 1. Belong to their tenant AND are associated with agencies in their tenant (or no agency)
-- 2. Super admins see all
CREATE POLICY "Users can view tables in their tenant scope"
ON public.crm_tables
FOR SELECT
USING (
  -- Super admin sees all
  is_super_admin(auth.uid())
  OR
  -- User sees tables in their tenant that are either:
  -- a) Not associated with any agency (general tables)
  -- b) Associated with an agency that belongs to user's tenant
  (
    tenant_id = get_user_tenant_id(auth.uid())
    AND (
      agency_id IS NULL
      OR EXISTS (
        SELECT 1 FROM agencies a
        WHERE a.id = crm_tables.agency_id
        AND a.tenant_id = get_user_tenant_id(auth.uid())
      )
    )
  )
);
