-- SEO staff should see and manage reports for all SEO-tagged clients in their
-- tenant / shared agencies — not only clients explicitly assigned via client_team.

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
    WHERE (
        public.has_role(_user_id, 'seo'::app_role)
        OR public.is_seo_staff(_user_id)
      )
      AND (
        c.is_seo_client = true
        OR c.services @> '["seo"]'::jsonb
      )
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
        public.has_role(_user_id, 'campaigner'::app_role)
        AND c.id = ANY(COALESCE(public.get_user_client_ids(_user_id), ARRAY[]::uuid[]))
      )
      OR (
        (
          public.has_role(_user_id, 'seo'::app_role)
          OR public.is_seo_staff(_user_id)
        )
        AND (
          c.is_seo_client = true
          OR c.services @> '["seo"]'::jsonb
        )
        AND (
          c.tenant_id = public.get_user_tenant_id(_user_id)
          OR public.user_has_cross_tenant_agency_access(_user_id, c.agency_id)
        )
      )
  );
$function$;

DROP POLICY IF EXISTS "SEO users can manage tables for SEO clients" ON public.crm_tables;

CREATE POLICY "SEO users can manage tables for SEO clients"
ON public.crm_tables
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'seo'::app_role)
  AND client_id IS NOT NULL
  AND public.user_can_access_client(auth.uid(), client_id)
)
WITH CHECK (
  public.has_role(auth.uid(), 'seo'::app_role)
  AND client_id IS NOT NULL
  AND public.user_can_access_client(auth.uid(), client_id)
);

-- Existing SEO users invited before dynamic_tables was in the default module set.
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
