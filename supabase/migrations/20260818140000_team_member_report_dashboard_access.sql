-- Team members (campaigners, SEO, etc.) must be able to create/open reports,
-- tables, and dashboards for clients in their scope — not only view them.

CREATE OR REPLACE FUNCTION public.user_can_manage_crm_dashboard(
  _user_id uuid,
  _tenant_id uuid,
  _agency_id uuid,
  _client_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_super_admin(_user_id)
    OR (
      _client_id IS NOT NULL
      AND public.user_can_access_client(_user_id, _client_id)
    )
    OR (
      NOT public.user_is_restricted_client_viewer(_user_id)
      AND (
        _tenant_id = public.get_user_tenant_id(_user_id)
        OR (
          _agency_id IS NOT NULL
          AND public.user_has_cross_tenant_agency_access(_user_id, _agency_id)
        )
      )
    );
$$;

DROP POLICY IF EXISTS "Users can create dashboards in their tenant" ON public.crm_dashboards;
CREATE POLICY "Users can create dashboards in their tenant"
ON public.crm_dashboards FOR INSERT TO authenticated
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR (
    client_id IS NOT NULL
    AND public.user_can_access_client(auth.uid(), client_id)
    AND tenant_id = COALESCE(
      (SELECT a.tenant_id FROM public.agencies a WHERE a.id = agency_id),
      (SELECT c.tenant_id FROM public.clients c WHERE c.id = client_id)
    )
  )
  OR (
    NOT public.user_is_restricted_client_viewer(auth.uid())
    AND (
      tenant_id = public.get_user_tenant_id(auth.uid())
      OR (
        agency_id IS NOT NULL
        AND public.user_has_cross_tenant_agency_access(auth.uid(), agency_id)
        AND tenant_id = (SELECT a.tenant_id FROM public.agencies a WHERE a.id = agency_id)
      )
    )
  )
);

-- crm_tables: allow cross-tenant home rows when the user can access the client
-- (shared-agency clients like DMM-MC store tables on the agency home tenant).
DROP POLICY IF EXISTS "Campaigners can manage tables for assigned clients" ON public.crm_tables;
CREATE POLICY "Campaigners can manage tables for assigned clients"
ON public.crm_tables
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'campaigner'::app_role)
  AND client_id IS NOT NULL
  AND public.user_can_access_client(auth.uid(), client_id)
)
WITH CHECK (
  public.has_role(auth.uid(), 'campaigner'::app_role)
  AND client_id IS NOT NULL
  AND public.user_can_access_client(auth.uid(), client_id)
);

DROP POLICY IF EXISTS "SEO users can manage tables for SEO clients" ON public.crm_tables;
CREATE POLICY "SEO users can manage tables for SEO clients"
ON public.crm_tables
FOR ALL
TO authenticated
USING (
  (
    public.has_role(auth.uid(), 'seo'::app_role)
    OR public.is_seo_staff(auth.uid())
  )
  AND client_id IS NOT NULL
  AND public.user_can_access_client(auth.uid(), client_id)
)
WITH CHECK (
  (
    public.has_role(auth.uid(), 'seo'::app_role)
    OR public.is_seo_staff(auth.uid())
  )
  AND client_id IS NOT NULL
  AND public.user_can_access_client(auth.uid(), client_id)
);

-- Module permission: reports/dashboards screen for existing team members.
UPDATE public.user_permissions up
SET can_access = true, updated_at = now()
FROM public.user_roles ur
WHERE up.user_id = ur.user_id
  AND up.module = 'dynamic_tables'
  AND ur.role IN ('campaigner'::app_role, 'seo'::app_role)
  AND up.can_access = false;

INSERT INTO public.user_permissions (user_id, module, can_access)
SELECT DISTINCT ur.user_id, 'dynamic_tables', true
FROM public.user_roles ur
WHERE ur.role IN ('campaigner'::app_role, 'seo'::app_role)
  AND NOT EXISTS (
    SELECT 1
    FROM public.user_permissions up
    WHERE up.user_id = ur.user_id
      AND up.module = 'dynamic_tables'
  );
