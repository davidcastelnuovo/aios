-- Drop all existing leads policies (including duplicate)
DROP POLICY IF EXISTS "Owners view all leads in tenant" ON leads;
DROP POLICY IF EXISTS "Sales people view assigned leads" ON leads;
DROP POLICY IF EXISTS "Super admins can view leads with permission" ON leads;
DROP POLICY IF EXISTS "Super admins view leads with permission" ON leads;
DROP POLICY IF EXISTS "Team managers view leads from managed agencies" ON leads;
DROP POLICY IF EXISTS "Users can create leads in their tenants" ON leads;
DROP POLICY IF EXISTS "Users can update leads in their tenants" ON leads;
DROP POLICY IF EXISTS "Super admins can manage leads with permission" ON leads;

-- Recreate all with TO authenticated (keeping exact same logic)

CREATE POLICY "Owners view all leads in tenant" ON leads
FOR SELECT TO authenticated
USING (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Sales people view assigned leads" ON leads
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'sales_person'::app_role)
  AND tenant_id = get_user_tenant_id(auth.uid())
  AND EXISTS (
    SELECT 1 FROM lead_sales_people lsp
    WHERE lsp.lead_id = leads.id
      AND lsp.tenant_id = leads.tenant_id
      AND lsp.sales_person_id = get_user_sales_person_id(auth.uid())
  )
);

CREATE POLICY "Super admins can view leads with permission" ON leads
FOR SELECT TO authenticated
USING (
  is_super_admin(auth.uid())
  AND (SELECT tenants.allow_super_admin_access FROM tenants WHERE tenants.id = leads.tenant_id) = true
);

CREATE POLICY "Team managers view leads from managed agencies" ON leads
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'team_manager'::app_role)
  AND (
    tenant_id = get_user_tenant_id(auth.uid())
    OR (agency_id IS NOT NULL AND user_manages_agency(auth.uid(), agency_id))
    OR (agency_id IS NOT NULL AND user_has_cross_tenant_agency_access(auth.uid(), agency_id))
  )
);

CREATE POLICY "Users can create leads in their tenants" ON leads
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.tenant_id = leads.tenant_id
      AND ur.role = ANY (ARRAY['owner'::app_role, 'team_manager'::app_role, 'campaigner'::app_role, 'sales_person'::app_role])
  )
  OR is_super_admin(auth.uid())
);

CREATE POLICY "Users can update leads in their tenants" ON leads
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.tenant_id = leads.tenant_id
      AND ur.role = ANY (ARRAY['owner'::app_role, 'team_manager'::app_role, 'campaigner'::app_role, 'sales_person'::app_role])
  )
  OR is_super_admin(auth.uid())
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.tenant_id = leads.tenant_id
      AND ur.role = ANY (ARRAY['owner'::app_role, 'team_manager'::app_role, 'campaigner'::app_role, 'sales_person'::app_role])
  )
  OR is_super_admin(auth.uid())
);

CREATE POLICY "Super admins can manage leads with permission" ON leads
FOR ALL TO authenticated
USING (
  is_super_admin(auth.uid())
  AND (SELECT tenants.allow_super_admin_access FROM tenants WHERE tenants.id = leads.tenant_id) = true
)
WITH CHECK (
  is_super_admin(auth.uid())
  AND (SELECT tenants.allow_super_admin_access FROM tenants WHERE tenants.id = leads.tenant_id) = true
);