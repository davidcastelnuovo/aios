-- Speed up everyday clients/tasks reads: one SELECT policy per table (early-exit helper)
-- plus indexes for per-row agency scope checks.

CREATE INDEX IF NOT EXISTS idx_user_roles_user_role_tenant
  ON public.user_roles (user_id, role, tenant_id);

CREATE INDEX IF NOT EXISTS idx_tenant_users_user_role_tenant
  ON public.tenant_users (user_id, role, tenant_id);

CREATE INDEX IF NOT EXISTS idx_agency_tenant_access_lookup
  ON public.agency_tenant_access (accessing_tenant_id, agency_id);

CREATE INDEX IF NOT EXISTS idx_user_managed_agencies_user_agency
  ON public.user_managed_agencies (user_id, agency_id);

CREATE INDEX IF NOT EXISTS idx_clients_tenant_status_created
  ON public.clients (tenant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tasks_tenant_due_date_status
  ON public.tasks (tenant_id, due_date, status);

CREATE OR REPLACE FUNCTION public.user_can_view_client(c public.clients)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  uid uuid := auth.uid();
  tid uuid;
  eff_tid uuid;
  client_ids uuid[];
  sales_agencies uuid[];
BEGIN
  IF uid IS NULL THEN
    RETURN false;
  END IF;

  -- Match stacked permissive policies: allow_super_admin_access grants full
  -- client read; if false, keep evaluating the other role paths below.
  IF public.is_super_admin(uid)
     AND COALESCE(
       (SELECT t.allow_super_admin_access FROM public.tenants t WHERE t.id = c.tenant_id),
       false
     ) THEN
    RETURN true;
  END IF;

  tid := public.get_user_tenant_id(uid);
  eff_tid := public.get_effective_tenant_id();

  IF public.has_role(uid, 'owner'::app_role)
     AND (c.tenant_id = tid OR public.user_has_cross_tenant_agency_access(uid, c.agency_id)) THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.tenant_users tu
    WHERE tu.user_id = uid
      AND tu.role IN ('owner', 'agency_owner')
      AND (
        c.tenant_id = tu.tenant_id
        OR public.user_has_cross_tenant_agency_access(uid, c.agency_id)
      )
  ) THEN
    RETURN true;
  END IF;

  IF public.has_role(uid, 'team_manager'::app_role)
     AND public.user_manages_agency(uid, c.agency_id)
     AND (
       c.tenant_id = eff_tid
       OR public.user_has_cross_tenant_agency_access(uid, c.agency_id)
     ) THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.tenant_users tu
    WHERE tu.user_id = uid
      AND tu.role = 'team_manager'
      AND (
        c.tenant_id = tu.tenant_id
        OR public.user_has_cross_tenant_agency_access(uid, c.agency_id)
      )
  )
  AND public.user_manages_agency(uid, c.agency_id) THEN
    RETURN true;
  END IF;

  client_ids := public.get_user_client_ids(uid);
  IF public.has_role(uid, 'campaigner'::app_role)
     AND c.id = ANY(COALESCE(client_ids, ARRAY[]::uuid[])) THEN
    RETURN true;
  END IF;

  IF (
    public.has_role(uid, 'seo'::app_role)
    OR public.is_seo_staff(uid)
  )
  AND (c.is_seo_client = true OR c.services @> '["seo"]'::jsonb)
  AND (
    c.tenant_id = tid
    OR public.user_has_cross_tenant_agency_access(uid, c.agency_id)
  ) THEN
    RETURN true;
  END IF;

  sales_agencies := public.get_user_sales_person_agency_ids(uid);
  IF c.tenant_id = tid
     AND c.agency_id = ANY(COALESCE(sales_agencies, ARRAY[]::uuid[])) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.user_can_view_task(t public.tasks)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  uid uuid := auth.uid();
  eff_tid uuid;
  client_ids uuid[];
  my_campaigner_id uuid;
BEGIN
  IF uid IS NULL THEN
    RETURN false;
  END IF;

  IF public.is_super_admin(uid) THEN
    RETURN true;
  END IF;

  eff_tid := public.get_effective_tenant_id();

  IF t.tenant_id = eff_tid AND public.has_role(uid, 'owner'::app_role) THEN
    RETURN true;
  END IF;

  IF public.has_role(uid, 'team_manager'::app_role)
     AND public.user_manages_agency(uid, t.agency_id) THEN
    IF t.tenant_id = eff_tid
       OR public.user_has_cross_tenant_agency_access(uid, t.agency_id) THEN
      RETURN true;
    END IF;
  END IF;

  my_campaigner_id := public.get_user_campaigner_id(uid);
  client_ids := public.get_user_client_ids(uid);

  IF public.has_role(uid, 'campaigner'::app_role)
     OR public.has_role(uid, 'seo'::app_role) THEN
    IF t.campaigner_id IS NOT NULL AND t.campaigner_id = my_campaigner_id THEN
      RETURN true;
    END IF;
    IF t.client_id IS NOT NULL
       AND t.client_id = ANY(COALESCE(client_ids, ARRAY[]::uuid[])) THEN
      RETURN true;
    END IF;
    IF t.created_by IS NOT NULL AND t.created_by = uid THEN
      RETURN true;
    END IF;
  END IF;

  IF t.lead_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.leads l
    WHERE l.id = t.lead_id
      AND (
        l.tenant_id = public.get_user_tenant_id(uid)
        OR public.is_super_admin(uid)
      )
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

COMMENT ON FUNCTION public.user_can_view_client(public.clients) IS
  'Unified clients SELECT scope — replaces stacked permissive policies for faster reads.';
COMMENT ON FUNCTION public.user_can_view_task(public.tasks) IS
  'Unified tasks SELECT scope — replaces stacked permissive policies for faster reads.';

DROP POLICY IF EXISTS "Campaigners view assigned clients" ON public.clients;
DROP POLICY IF EXISTS "Owners view all clients in tenant" ON public.clients;
DROP POLICY IF EXISTS "SEO users view SEO-tagged clients" ON public.clients;
DROP POLICY IF EXISTS "Sales people can view clients from their agencies" ON public.clients;
DROP POLICY IF EXISTS "Super admins can view clients with permission" ON public.clients;
DROP POLICY IF EXISTS "Super admins view clients with permission" ON public.clients;
DROP POLICY IF EXISTS "Team managers view clients from managed agencies" ON public.clients;

CREATE POLICY "Users can view clients in scope"
  ON public.clients
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (public.user_can_view_client(clients));

DROP POLICY IF EXISTS "Users can view tasks for their leads" ON public.tasks;
DROP POLICY IF EXISTS "Users can view tasks from accessible agencies" ON public.tasks;

CREATE POLICY "Users can view tasks in scope"
  ON public.tasks
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (public.user_can_view_task(tasks));
