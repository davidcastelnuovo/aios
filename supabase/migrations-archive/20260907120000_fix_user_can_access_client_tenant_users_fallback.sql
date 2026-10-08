-- Owners/managers listed only in tenant_users (e.g. Felix on DMM) were visible in the
-- pulse dashboard client list (frontend checks tenant_users) but campaign_pulse_snapshots
-- RLS uses user_can_access_client(), which only checked user_roles via has_role().
-- Result: cards showed "ממתין לבדיקת דופק" with no metrics for unassigned clients.

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

COMMENT ON FUNCTION public.user_can_access_client(uuid, uuid) IS
  'Client scope for RLS: user_roles plus tenant_users fallback for owner/agency_owner/team_manager (legacy invites).';
