-- Hybrid SEO staff (campaigner.role includes 'SEO' plus קמפיינר/מנהל צוות) were
-- excluded from is_seo_staff and often lack user_roles.seo — so they could not
-- see SEO-tagged clients/reports (e.g. נופר זומר, Exsitu / X2).

CREATE OR REPLACE FUNCTION public.client_is_seo_tagged(is_seo_client boolean, services_val jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(is_seo_client, false)
    OR COALESCE(services_val @> '["seo"]'::jsonb, false);
$$;

CREATE OR REPLACE FUNCTION public.user_has_seo_scope(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    public.has_role(_user_id, 'seo'::app_role)
    OR public.is_seo_staff(_user_id)
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN public.campaigners c ON c.id = p.campaigner_id
      WHERE p.id = _user_id
        AND c.role @> ARRAY['SEO']::text[]
    );
$$;

COMMENT ON FUNCTION public.user_has_seo_scope(uuid) IS
  'True for seo app_role, pure SEO staff (is_seo_staff), or any campaigner profile tagged SEO (including hybrid קמפיינר+SEO).';

CREATE OR REPLACE FUNCTION public.get_user_client_ids(_user_id uuid)
 RETURNS uuid[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH campaigner_clients AS (
    SELECT ct.client_id
    FROM public.profiles p
    JOIN public.client_team ct ON ct.campaigner_id = p.campaigner_id
    WHERE p.id = _user_id
      AND public.has_role(_user_id, 'campaigner'::app_role)
  ),
  seo_clients AS (
    SELECT c.id AS client_id
    FROM public.clients c
    WHERE public.user_has_seo_scope(_user_id)
      AND public.client_is_seo_tagged(c.is_seo_client, to_jsonb(c.services))
      AND (
        c.tenant_id = public.get_user_tenant_id(_user_id)
        OR public.user_has_cross_tenant_agency_access(_user_id, c.agency_id)
      )
  )
  SELECT COALESCE(
    ARRAY_AGG(DISTINCT client_id),
    ARRAY[]::uuid[]
  )
  FROM (
    SELECT client_id FROM campaigner_clients
    UNION ALL
    SELECT client_id FROM seo_clients
  ) combined
$function$;

CREATE OR REPLACE FUNCTION public.user_can_access_client(_user_id uuid, _client_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH client_scope AS (
    SELECT id, tenant_id, agency_id, is_seo_client, services
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
        (public.has_role(_user_id, 'owner'::app_role) OR public.has_role(_user_id, 'agency_owner'::app_role))
        AND (
          c.tenant_id = public.get_user_tenant_id(_user_id)
          OR public.user_has_cross_tenant_agency_access(_user_id, c.agency_id)
        )
      )
      OR (
        EXISTS (
          SELECT 1
          FROM public.tenant_users tu
          WHERE tu.user_id = _user_id
            AND tu.role IN ('owner', 'agency_owner')
            AND (
              c.tenant_id = tu.tenant_id
              OR public.user_has_cross_tenant_agency_access(_user_id, c.agency_id)
            )
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
        EXISTS (
          SELECT 1
          FROM public.tenant_users tu
          WHERE tu.user_id = _user_id
            AND tu.role = 'team_manager'
            AND (
              c.tenant_id = tu.tenant_id
              OR public.user_has_cross_tenant_agency_access(_user_id, c.agency_id)
            )
        )
        AND public.user_manages_agency(_user_id, c.agency_id)
      )
      OR (
        public.has_role(_user_id, 'sales_person'::app_role)
        AND c.agency_id = ANY(COALESCE(public.get_user_sales_person_agency_ids(_user_id), ARRAY[]::uuid[]))
      )
      OR (
        public.has_role(_user_id, 'campaigner'::app_role)
        AND c.id = ANY(COALESCE(public.get_user_client_ids(_user_id), ARRAY[]::uuid[]))
      )
      OR (
        public.user_has_seo_scope(_user_id)
        AND public.client_is_seo_tagged(c.is_seo_client, to_jsonb(c.services))
        AND (
          c.tenant_id = public.get_user_tenant_id(_user_id)
          OR public.user_has_cross_tenant_agency_access(_user_id, c.agency_id)
        )
      )
  );
$function$;

-- Patch unified clients policy helper when present (develop / staging).
DO $do$
BEGIN
  IF to_regprocedure('public.user_can_view_client(public.clients)') IS NOT NULL THEN
    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION public.user_can_view_client(c public.clients)
      RETURNS boolean
      LANGUAGE plpgsql
      STABLE
      SECURITY DEFINER
      SET search_path TO public
      AS $body$
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
             c.tenant_id = tid
             OR c.tenant_id = eff_tid
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

        IF public.user_has_seo_scope(uid)
           AND public.client_is_seo_tagged(c.is_seo_client, to_jsonb(c.services))
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
      $body$;
    $fn$;
  END IF;
END
$do$;

DROP POLICY IF EXISTS "SEO users view SEO-tagged clients" ON public.clients;
CREATE POLICY "SEO users view SEO-tagged clients"
ON public.clients
FOR SELECT
TO authenticated
USING (
  public.user_has_seo_scope(auth.uid())
  AND public.client_is_seo_tagged(is_seo_client, to_jsonb(services))
  AND (
    tenant_id = public.get_user_tenant_id(auth.uid())
    OR public.user_has_cross_tenant_agency_access(auth.uid(), agency_id)
  )
);

DROP POLICY IF EXISTS "SEO users can manage tables for SEO clients" ON public.crm_tables;
CREATE POLICY "SEO users can manage tables for SEO clients"
ON public.crm_tables
FOR ALL
TO authenticated
USING (
  public.user_has_seo_scope(auth.uid())
  AND client_id IS NOT NULL
  AND public.user_can_access_client(auth.uid(), client_id)
)
WITH CHECK (
  public.user_has_seo_scope(auth.uid())
  AND client_id IS NOT NULL
  AND public.user_can_access_client(auth.uid(), client_id)
);

INSERT INTO public.user_permissions (user_id, module, can_access)
SELECT ur.user_id, 'dynamic_tables', true
FROM public.user_roles ur
WHERE ur.role = 'seo'::app_role
  AND NOT EXISTS (
    SELECT 1
    FROM public.user_permissions up
    WHERE up.user_id = ur.user_id
      AND up.module = 'dynamic_tables'
  );
