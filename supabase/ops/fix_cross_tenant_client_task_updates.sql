-- Applied via .github/workflows/apply-sql-migration.yml (Management API).
-- Source of truth also lives in:
--   supabase/migrations/20260803140000_fix_cross_tenant_client_task_updates.sql

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
