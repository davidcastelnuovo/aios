-- Shared agencies belong to their parent org, and both orgs see the same data.
--
-- Context: the DMM-MC agency is shared between DMM and MarketingCaptain. Because
-- set_client_tenant_id() assigns a new client's tenant from the *agency owner*,
-- clients created through the MarketingCaptain tenant landed in MarketingCaptain
-- and were invisible to the DMM team (e.g. Felix, an owner of DMM). Per product
-- rule: a shared agency's home is its parent org (DMM), and everyone with access
-- to the agency in either org must keep seeing its clients, assignments,
-- reports and tasks.
--
-- This migration:
--   1. Makes DMM the owner (home) of the DMM-MC agency, so the existing
--      set_client_tenant_id() trigger and the crm-tables function assign future
--      rows to DMM automatically.
--   2. Backfills existing DMM-MC clients / reports / dashboards from the
--      MarketingCaptain tenant into DMM.
--   3. Adds cross-tenant SELECT policies (mirroring the ones already present on
--      crm_tables / crm_dashboards) so a user whose tenant has cross-tenant
--      access to a shared agency can view that agency's clients, client_team
--      assignments and tasks — keeping MarketingCaptain's access intact after the
--      move and fixing the DMM side symmetrically.

DO $$
DECLARE
  v_dmm    uuid := '6ad8f321-25db-4a04-8e44-e57a7c8961b2';  -- DMM (parent / home)
  v_mc     uuid := '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019';  -- MarketingCaptain
  v_agency uuid := '38cf0e62-1913-45cb-b917-88e421974fb1';  -- DMM-MC (shared)
  v_moved_clients uuid[];
BEGIN
  -- 1) Agency home -> DMM
  UPDATE public.agencies SET tenant_id = v_dmm WHERE id = v_agency AND tenant_id <> v_dmm;

  -- Keep MarketingCaptain's cross-tenant access to the agency (owner is now DMM).
  INSERT INTO public.agency_tenant_access (agency_id, source_tenant_id, accessing_tenant_id, access_level)
  SELECT v_agency, v_dmm, v_mc, 'read_write'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.agency_tenant_access
    WHERE agency_id = v_agency AND accessing_tenant_id = v_mc
  );

  -- 2) Backfill existing rows from MarketingCaptain -> DMM
  SELECT array_agg(id) INTO v_moved_clients
  FROM public.clients WHERE agency_id = v_agency AND tenant_id = v_mc;

  UPDATE public.clients        SET tenant_id = v_dmm WHERE agency_id = v_agency AND tenant_id = v_mc;
  UPDATE public.crm_tables     SET tenant_id = v_dmm
    WHERE tenant_id = v_mc AND (agency_id = v_agency OR client_id = ANY (COALESCE(v_moved_clients, ARRAY[]::uuid[])));
  UPDATE public.crm_dashboards SET tenant_id = v_dmm
    WHERE tenant_id = v_mc AND (agency_id = v_agency OR client_id = ANY (COALESCE(v_moved_clients, ARRAY[]::uuid[])));

  INSERT INTO public.claude_carmen_audit (actor, action, target, details)
  VALUES ('claude', 'agency_home_reassign', 'agencies:DMM-MC',
    jsonb_build_object(
      'rule', 'shared agency clients belong to parent org',
      'agency', 'DMM-MC',
      'from_tenant', v_mc,
      'to_tenant', v_dmm,
      'moved_client_count', COALESCE(array_length(v_moved_clients, 1), 0),
      'moved_client_ids', to_jsonb(COALESCE(v_moved_clients, ARRAY[]::uuid[]))
    ));
END $$;

-- 3) Cross-tenant visibility for shared agencies.
DROP POLICY IF EXISTS "Shared-agency cross-tenant client view" ON public.clients;
CREATE POLICY "Shared-agency cross-tenant client view" ON public.clients
  FOR SELECT
  USING (
    (NOT public.user_is_restricted_client_viewer(auth.uid()))
    AND agency_id IS NOT NULL
    AND public.user_has_cross_tenant_agency_access(auth.uid(), agency_id)
  );

DROP POLICY IF EXISTS "Shared-agency cross-tenant client_team view" ON public.client_team;
CREATE POLICY "Shared-agency cross-tenant client_team view" ON public.client_team
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = client_team.client_id
        AND c.agency_id IS NOT NULL
        AND (NOT public.user_is_restricted_client_viewer(auth.uid()))
        AND public.user_has_cross_tenant_agency_access(auth.uid(), c.agency_id)
    )
  );

DROP POLICY IF EXISTS "Shared-agency cross-tenant task view" ON public.tasks;
CREATE POLICY "Shared-agency cross-tenant task view" ON public.tasks
  FOR SELECT
  USING (
    (NOT public.user_is_restricted_client_viewer(auth.uid()))
    AND agency_id IS NOT NULL
    AND public.user_has_cross_tenant_agency_access(auth.uid(), agency_id)
  );
