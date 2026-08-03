-- Applied via .github/workflows/apply-sql-migration.yml (Management API).
-- Source of truth also lives in:
--   supabase/migrations/20260803140000_fix_cross_tenant_client_task_updates.sql

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
      OR (
        has_role(auth.uid(), 'seo'::app_role)
        AND (is_seo_client = true OR services @> '["seo"]'::jsonb)
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
      OR (
        has_role(auth.uid(), 'seo'::app_role)
        AND (is_seo_client = true OR services @> '["seo"]'::jsonb)
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
