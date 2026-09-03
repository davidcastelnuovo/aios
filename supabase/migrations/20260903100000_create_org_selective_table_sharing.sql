-- Selective CRM table sharing for "Create Organization for Client"
-- Mirrors wordpress_sites_shared_tenants / social_pages_shared_tenants pattern.

CREATE TABLE IF NOT EXISTS public.crm_tables_shared_tenants (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  crm_table_id uuid        NOT NULL REFERENCES public.crm_tables(id) ON DELETE CASCADE,
  tenant_id    uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  shared_by    uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  shared_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (crm_table_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_crm_tables_shared_table  ON public.crm_tables_shared_tenants(crm_table_id);
CREATE INDEX IF NOT EXISTS idx_crm_tables_shared_tenant ON public.crm_tables_shared_tenants(tenant_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_tables_shared_tenants TO authenticated;
GRANT ALL ON public.crm_tables_shared_tenants TO service_role;
ALTER TABLE public.crm_tables_shared_tenants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_tables_shared_manage" ON public.crm_tables_shared_tenants;
CREATE POLICY "crm_tables_shared_manage" ON public.crm_tables_shared_tenants
  FOR ALL TO authenticated
  USING (
    is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.crm_tables t
      WHERE t.id = crm_tables_shared_tenants.crm_table_id
        AND t.tenant_id IN (SELECT tu.tenant_id FROM public.tenant_users tu WHERE tu.user_id = auth.uid())
        AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'team_manager'::app_role))
    )
    OR tenant_id IN (SELECT tu.tenant_id FROM public.tenant_users tu WHERE tu.user_id = auth.uid())
  )
  WITH CHECK (
    is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.crm_tables t
      WHERE t.id = crm_tables_shared_tenants.crm_table_id
        AND t.tenant_id IN (SELECT tu.tenant_id FROM public.tenant_users tu WHERE tu.user_id = auth.uid())
        AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'team_manager'::app_role))
    )
  );

-- Extend table access helper so shared tables are visible in child tenants.
CREATE OR REPLACE FUNCTION public.user_can_access_crm_table(_user_id uuid, _table_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH table_scope AS (
    SELECT id, tenant_id, agency_id, client_id
    FROM public.crm_tables
    WHERE id = _table_id
    LIMIT 1
  )
  SELECT EXISTS (
    SELECT 1
    FROM table_scope t
    WHERE
      public.is_super_admin(_user_id)
      OR (
        t.client_id IS NOT NULL
        AND public.user_can_access_client(_user_id, t.client_id)
      )
      OR (
        NOT public.user_is_restricted_client_viewer(_user_id)
        AND t.client_id IS NULL
        AND (
          t.tenant_id = public.get_user_tenant_id(_user_id)
          OR public.user_has_cross_tenant_agency_access(_user_id, t.agency_id)
        )
      )
      OR EXISTS (
        SELECT 1
        FROM public.crm_tables_shared_tenants cts
        WHERE cts.crm_table_id = t.id
          AND cts.tenant_id IN (
            SELECT tu.tenant_id FROM public.tenant_users tu WHERE tu.user_id = _user_id
          )
      )
  );
$function$;
