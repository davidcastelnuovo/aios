CREATE OR REPLACE FUNCTION public.user_is_restricted_client_viewer(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    _user_id IS NOT NULL
    AND NOT public.is_super_admin(_user_id)
    AND NOT public.has_role(_user_id, 'owner'::app_role)
    AND NOT public.has_role(_user_id, 'team_manager'::app_role)
    AND (
      public.has_role(_user_id, 'campaigner'::app_role)
      OR public.has_role(_user_id, 'seo'::app_role)
    );
$$;

CREATE OR REPLACE FUNCTION public.user_can_access_client(_user_id uuid, _client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH client_scope AS (
    SELECT id, tenant_id, agency_id
    FROM public.clients
    WHERE id = _client_id
    LIMIT 1
  )
  SELECT EXISTS (
    SELECT 1
    FROM client_scope c
    WHERE
      public.is_super_admin(_user_id)
      OR (
        public.has_role(_user_id, 'owner'::app_role)
        AND (
          c.tenant_id = public.get_user_tenant_id(_user_id)
          OR public.user_has_cross_tenant_agency_access(_user_id, c.agency_id)
        )
      )
      OR (
        public.has_role(_user_id, 'team_manager'::app_role)
        AND public.user_manages_agency(_user_id, c.agency_id)
        AND (
          c.tenant_id = public.get_user_tenant_id(_user_id)
          OR public.user_has_cross_tenant_agency_access(_user_id, c.agency_id)
        )
      )
      OR (
        public.has_role(_user_id, 'sales_person'::app_role)
        AND c.agency_id = ANY(COALESCE(public.get_user_sales_person_agency_ids(_user_id), ARRAY[]::uuid[]))
      )
      OR (
        (
          public.has_role(_user_id, 'campaigner'::app_role)
          OR public.has_role(_user_id, 'seo'::app_role)
        )
        AND c.id = ANY(COALESCE(public.get_user_client_ids(_user_id), ARRAY[]::uuid[]))
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.user_can_access_crm_table(_user_id uuid, _table_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
  );
$$;

DROP POLICY IF EXISTS "Users can view tables in their tenant scope" ON public.crm_tables;
CREATE POLICY "Users can view tables by role scope"
ON public.crm_tables
FOR SELECT
TO authenticated
USING (public.user_can_access_crm_table(auth.uid(), id));

DROP POLICY IF EXISTS "Users can view dashboards in their tenant" ON public.crm_dashboards;
CREATE POLICY "Users can view dashboards by role scope"
ON public.crm_dashboards
FOR SELECT
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR (
    client_id IS NOT NULL
    AND public.user_can_access_client(auth.uid(), client_id)
  )
  OR (
    NOT public.user_is_restricted_client_viewer(auth.uid())
    AND client_id IS NULL
    AND (
      tenant_id = public.get_user_tenant_id(auth.uid())
      OR public.user_has_cross_tenant_agency_access(auth.uid(), agency_id)
    )
  )
);

DROP POLICY IF EXISTS "Restrict campaigner record reads to assigned clients" ON public.crm_records;
CREATE POLICY "Restrict campaigner record reads to assigned clients"
ON public.crm_records
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (
  NOT public.user_is_restricted_client_viewer(auth.uid())
  OR public.user_can_access_crm_table(auth.uid(), table_id)
);

DROP POLICY IF EXISTS "Restrict campaigner ahrefs reports to assigned clients" ON public.ahrefs_reports;
CREATE POLICY "Restrict campaigner ahrefs reports to assigned clients"
ON public.ahrefs_reports
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (
  NOT public.user_is_restricted_client_viewer(auth.uid())
  OR (
    client_id IS NOT NULL
    AND public.user_can_access_client(auth.uid(), client_id)
  )
);

CREATE INDEX IF NOT EXISTS idx_client_team_campaigner_client ON public.client_team(campaigner_id, client_id);
CREATE INDEX IF NOT EXISTS idx_crm_tables_client_id ON public.crm_tables(client_id);
CREATE INDEX IF NOT EXISTS idx_crm_records_table_id ON public.crm_records(table_id);
CREATE INDEX IF NOT EXISTS idx_ahrefs_reports_client_id ON public.ahrefs_reports(client_id);