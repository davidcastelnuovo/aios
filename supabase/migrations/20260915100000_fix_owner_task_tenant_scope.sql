-- Owners in an effective tenant see their org's tasks only.
-- Cross-tenant tasks appear when linked to a client whose agency is shared
-- into the active tenant (agency_tenant_access), matching the tasks board rules.

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

  IF t.tenant_id = eff_tid THEN
    IF public.has_role(uid, 'owner'::app_role) THEN
      RETURN true;
    END IF;
    IF EXISTS (
      SELECT 1
      FROM public.tenant_users tu
      WHERE tu.user_id = uid
        AND tu.tenant_id = eff_tid
        AND tu.role IN ('owner', 'agency_owner')
    ) THEN
      RETURN true;
    END IF;
  END IF;

  IF t.client_id IS NOT NULL
     AND t.tenant_id IS DISTINCT FROM eff_tid
     AND (
       public.has_role(uid, 'owner'::app_role)
       OR EXISTS (
         SELECT 1
         FROM public.tenant_users tu
         WHERE tu.user_id = uid
           AND tu.tenant_id = eff_tid
           AND tu.role IN ('owner', 'agency_owner')
       )
     )
     AND EXISTS (
       SELECT 1
       FROM public.clients c
       WHERE c.id = t.client_id
         AND public.user_has_cross_tenant_agency_access(uid, c.agency_id)
     ) THEN
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

COMMENT ON FUNCTION public.user_can_view_task(public.tasks) IS
  'Tasks SELECT scope: owners see their effective tenant plus cross-tenant rows for shared-agency clients only.';
