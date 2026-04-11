
-- ==========================================
-- 1. client_team - uses get_client_tenant_id, needs cross-tenant
-- ==========================================
DROP POLICY IF EXISTS "Users can view client_team in their tenant" ON public.client_team;
CREATE POLICY "Users can view client_team in their tenant"
ON public.client_team FOR SELECT TO authenticated
USING (
  get_client_tenant_id(client_id) = get_user_tenant_id(auth.uid())
  OR is_super_admin(auth.uid())
  OR user_has_cross_tenant_client_access(auth.uid(), client_id)
);

DROP POLICY IF EXISTS "Users can update client_team in their tenant" ON public.client_team;
CREATE POLICY "Users can update client_team in their tenant"
ON public.client_team FOR UPDATE TO authenticated
USING (
  get_client_tenant_id(client_id) = get_user_tenant_id(auth.uid())
  OR is_super_admin(auth.uid())
  OR user_has_cross_tenant_client_access(auth.uid(), client_id)
);

DROP POLICY IF EXISTS "Users can delete client_team in their tenant" ON public.client_team;
CREATE POLICY "Users can delete client_team in their tenant"
ON public.client_team FOR DELETE TO authenticated
USING (
  get_client_tenant_id(client_id) = get_user_tenant_id(auth.uid())
  OR is_super_admin(auth.uid())
  OR user_has_cross_tenant_client_access(auth.uid(), client_id)
);

DROP POLICY IF EXISTS "Users can insert client_team in their tenant" ON public.client_team;
CREATE POLICY "Users can insert client_team in their tenant"
ON public.client_team FOR INSERT TO authenticated
WITH CHECK (
  get_client_tenant_id(client_id) = get_user_tenant_id(auth.uid())
  OR is_super_admin(auth.uid())
  OR user_has_cross_tenant_client_access(auth.uid(), client_id)
);

-- ==========================================
-- 2. client_suppliers - needs cross-tenant
-- ==========================================
DROP POLICY IF EXISTS "Users can view client_suppliers in their tenant" ON public.client_suppliers;
CREATE POLICY "Users can view client_suppliers in their tenant"
ON public.client_suppliers FOR SELECT TO authenticated
USING (
  get_client_tenant_id(client_id) = get_user_tenant_id(auth.uid())
  OR is_super_admin(auth.uid())
  OR user_has_cross_tenant_client_access(auth.uid(), client_id)
);

DROP POLICY IF EXISTS "Users can update client_suppliers in their tenant" ON public.client_suppliers;
CREATE POLICY "Users can update client_suppliers in their tenant"
ON public.client_suppliers FOR UPDATE TO authenticated
USING (
  get_client_tenant_id(client_id) = get_user_tenant_id(auth.uid())
  OR is_super_admin(auth.uid())
  OR user_has_cross_tenant_client_access(auth.uid(), client_id)
);

DROP POLICY IF EXISTS "Users can delete client_suppliers in their tenant" ON public.client_suppliers;
CREATE POLICY "Users can delete client_suppliers in their tenant"
ON public.client_suppliers FOR DELETE TO authenticated
USING (
  get_client_tenant_id(client_id) = get_user_tenant_id(auth.uid())
  OR is_super_admin(auth.uid())
  OR user_has_cross_tenant_client_access(auth.uid(), client_id)
);

DROP POLICY IF EXISTS "Users can insert client_suppliers in their tenant" ON public.client_suppliers;
CREATE POLICY "Users can insert client_suppliers in their tenant"
ON public.client_suppliers FOR INSERT TO authenticated
WITH CHECK (
  get_client_tenant_id(client_id) = get_user_tenant_id(auth.uid())
  OR is_super_admin(auth.uid())
  OR user_has_cross_tenant_client_access(auth.uid(), client_id)
);

-- ==========================================
-- 3. leads - Owners need cross-tenant SELECT + UPDATE
-- ==========================================
DROP POLICY IF EXISTS "Owners view all leads in tenant" ON public.leads;
CREATE POLICY "Owners view all leads in tenant"
ON public.leads FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'owner'::app_role) 
  AND (
    tenant_id = get_user_tenant_id(auth.uid())
    OR user_has_cross_tenant_agency_access(auth.uid(), agency_id)
  )
);

DROP POLICY IF EXISTS "Users can update leads in their tenants" ON public.leads;
CREATE POLICY "Users can update leads in their tenants"
ON public.leads FOR UPDATE TO authenticated
USING (
  is_super_admin(auth.uid())
  OR (
    (tenant_id = get_user_tenant_id(auth.uid()) OR user_has_cross_tenant_agency_access(auth.uid(), agency_id))
    AND (
      has_role(auth.uid(), 'owner'::app_role)
      OR has_role(auth.uid(), 'team_manager'::app_role)
      OR has_role(auth.uid(), 'sales_person'::app_role)
    )
  )
)
WITH CHECK (
  is_super_admin(auth.uid())
  OR (
    (tenant_id = get_user_tenant_id(auth.uid()) OR user_has_cross_tenant_agency_access(auth.uid(), agency_id))
    AND (
      has_role(auth.uid(), 'owner'::app_role)
      OR has_role(auth.uid(), 'team_manager'::app_role)
      OR has_role(auth.uid(), 'sales_person'::app_role)
    )
  )
);

-- ==========================================
-- 4. ahrefs_reports - SELECT needs cross-tenant
-- ==========================================
DROP POLICY IF EXISTS "Users can view ahrefs_reports in their tenant" ON public.ahrefs_reports;
CREATE POLICY "Users can view ahrefs_reports in their tenant"
ON public.ahrefs_reports FOR SELECT TO authenticated
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  OR is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM agency_tenant_access ata
    WHERE ata.agency_id = ahrefs_reports.agency_id
      AND ata.accessing_tenant_id = get_user_tenant_id(auth.uid())
  )
);

-- ==========================================
-- 5. seo_monthly_updates - needs cross-tenant
-- ==========================================
DROP POLICY IF EXISTS "seo_monthly_updates_tenant_access" ON public.seo_monthly_updates;
CREATE POLICY "seo_monthly_updates_tenant_access"
ON public.seo_monthly_updates FOR ALL TO authenticated
USING (
  tenant_id IN (SELECT tu.tenant_id FROM tenant_users tu WHERE tu.user_id = auth.uid())
  OR is_super_admin(auth.uid())
  OR user_has_cross_tenant_client_access(auth.uid(), client_id)
);

-- ==========================================
-- 6. client_onboarding - ALL (manage) needs cross-tenant
-- ==========================================
DROP POLICY IF EXISTS "Users can manage client_onboarding in their tenant" ON public.client_onboarding;
CREATE POLICY "Users can manage client_onboarding in their tenant"
ON public.client_onboarding FOR ALL TO authenticated
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  OR is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM agency_tenant_access ata
    WHERE ata.agency_id = client_onboarding.agency_id
      AND ata.accessing_tenant_id = get_user_tenant_id(auth.uid())
  )
);

-- ==========================================
-- 7. crm_tables - SELECT needs cross-tenant
-- ==========================================
DROP POLICY IF EXISTS "Users can view tables in their tenant scope" ON public.crm_tables;
CREATE POLICY "Users can view tables in their tenant scope"
ON public.crm_tables FOR SELECT TO authenticated
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  OR is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM agency_tenant_access ata
    WHERE ata.agency_id = crm_tables.agency_id
      AND ata.accessing_tenant_id = get_user_tenant_id(auth.uid())
  )
);

-- ==========================================
-- 8. crm_dashboards - SELECT needs cross-tenant
-- ==========================================
DROP POLICY IF EXISTS "Users can view dashboards in their tenant" ON public.crm_dashboards;
CREATE POLICY "Users can view dashboards in their tenant"
ON public.crm_dashboards FOR SELECT TO authenticated
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  OR is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM agency_tenant_access ata
    WHERE ata.agency_id = crm_dashboards.agency_id
      AND ata.accessing_tenant_id = get_user_tenant_id(auth.uid())
  )
);
