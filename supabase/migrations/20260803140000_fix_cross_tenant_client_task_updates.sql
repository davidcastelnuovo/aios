-- Fix: team managers (e.g. Anna on MarketingCaptain) can SELECT shared-agency
-- clients/tasks on DMM-MC via agency_tenant_access, but UPDATE policies still
-- required tenant_id = get_user_tenant_id() — so edits silently failed / errored.
--
-- Align clients UPDATE with shared-tenant access, and allow team managers /
-- assigned campaigners to UPDATE tasks on agencies they can already access
-- cross-tenant. Also let SEO update SEO-tagged clients they can see.
-- Note: clients.services is jsonb (array of strings), not text[].

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
      OR (
        agency_id IS NOT NULL
        AND user_has_cross_tenant_agency_access(auth.uid(), agency_id)
      )
    )
    AND (
      has_role(auth.uid(), 'owner'::app_role)
      OR (
        has_role(auth.uid(), 'team_manager'::app_role)
        AND (
          tenant_id = get_effective_tenant_id()
          OR user_manages_agency(auth.uid(), agency_id)
        )
      )
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
      OR (
        agency_id IS NOT NULL
        AND user_has_cross_tenant_agency_access(auth.uid(), agency_id)
      )
    )
    AND (
      has_role(auth.uid(), 'owner'::app_role)
      OR (
        has_role(auth.uid(), 'team_manager'::app_role)
        AND (
          tenant_id = get_effective_tenant_id()
          OR user_manages_agency(auth.uid(), agency_id)
        )
      )
      OR (
        has_role(auth.uid(), 'campaigner'::app_role)
        AND campaigner_id = get_user_campaigner_id(auth.uid())
      )
    )
  )
);
