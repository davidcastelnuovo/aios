-- Fix cross-tenant client/task UPDATEs for shared agencies (e.g. MarketingCaptain ↔ DMM-MC).
--
-- Background:
--   DMM-MC clients live on the DMM tenant but are shared with MarketingCaptain via
--   agency_tenant_access. SELECT policies already allow TMs/campaigners on MC to see
--   those rows, but UPDATE still required tenant_id = the user's active tenant.
--   Result: Anna (and anyone on MC) could see DMM-MC clients/tasks but every edit
--   returned 0 rows / "Update blocked by permissions".
--
--   The clients policy below is the same change that landed in
--   20260409064938_d36d11b2-8c13-4482-8331-9f0611e48fbd.sql but was never applied
--   to production. Re-issue it under a current version so the Management API apply
--   path picks it up.

-- ── clients UPDATE ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can update clients" ON public.clients;
DROP POLICY IF EXISTS "Users can update clients in their tenants" ON public.clients;
DROP POLICY IF EXISTS "Users can update clients in their or shared tenants" ON public.clients;

CREATE POLICY "Users can update clients in their or shared tenants"
ON public.clients
FOR UPDATE
TO authenticated
USING (
  is_super_admin(auth.uid())
  OR (
    (
      tenant_id = get_user_tenant_id(auth.uid())
      OR user_has_cross_tenant_agency_access(auth.uid(), agency_id)
    )
    AND (
      has_role(auth.uid(), 'owner'::app_role)
      OR has_role(auth.uid(), 'team_manager'::app_role)
      OR has_role(auth.uid(), 'sales_person'::app_role)
      OR (
        has_role(auth.uid(), 'campaigner'::app_role)
        AND id = ANY (get_user_client_ids(auth.uid()))
      )
    )
  )
)
WITH CHECK (
  is_super_admin(auth.uid())
  OR (
    (
      tenant_id = get_user_tenant_id(auth.uid())
      OR user_has_cross_tenant_agency_access(auth.uid(), agency_id)
    )
    AND (
      has_role(auth.uid(), 'owner'::app_role)
      OR has_role(auth.uid(), 'team_manager'::app_role)
      OR has_role(auth.uid(), 'sales_person'::app_role)
      OR (
        has_role(auth.uid(), 'campaigner'::app_role)
        AND id = ANY (get_user_client_ids(auth.uid()))
      )
    )
  )
);

-- ── tasks UPDATE ────────────────────────────────────────────────────────────
-- Mirror the clients rule: same-tenant OR shared-agency, with the existing role
-- gates. Do NOT require user_roles.tenant_id = tasks.tenant_id — that blocked
-- every cross-tenant update even when agency_tenant_access was present.
DROP POLICY IF EXISTS "Users can update tasks in accessible agencies" ON public.tasks;

CREATE POLICY "Users can update tasks in accessible agencies"
ON public.tasks
FOR UPDATE
TO authenticated
USING (
  is_super_admin(auth.uid())
  OR (
    (
      tenant_id = get_effective_tenant_id()
      OR user_has_cross_tenant_agency_access(auth.uid(), agency_id)
    )
    AND (
      has_role(auth.uid(), 'owner'::app_role)
      OR has_role(auth.uid(), 'team_manager'::app_role)
      OR has_role(auth.uid(), 'sales_person'::app_role)
      OR (
        has_role(auth.uid(), 'campaigner'::app_role)
        AND campaigner_id = get_user_campaigner_id(auth.uid())
      )
    )
  )
)
WITH CHECK (
  is_super_admin(auth.uid())
  OR (
    (
      tenant_id = get_effective_tenant_id()
      OR user_has_cross_tenant_agency_access(auth.uid(), agency_id)
    )
    AND (
      has_role(auth.uid(), 'owner'::app_role)
      OR has_role(auth.uid(), 'team_manager'::app_role)
      OR has_role(auth.uid(), 'sales_person'::app_role)
      OR (
        has_role(auth.uid(), 'campaigner'::app_role)
        AND campaigner_id = get_user_campaigner_id(auth.uid())
      )
    )
  )
);
