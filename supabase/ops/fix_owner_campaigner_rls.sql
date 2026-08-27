-- Apply owner campaigner RLS + user_roles backfill (PR #497).
-- Mirrors supabase/migrations/20260827100000_fix_owner_campaigner_rls_and_user_roles.sql

INSERT INTO public.user_roles (user_id, role, tenant_id)
SELECT tu.user_id, tu.role::public.app_role, tu.tenant_id
FROM public.tenant_users tu
WHERE tu.role IN ('owner', 'agency_owner', 'team_manager')
  AND NOT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = tu.user_id
      AND ur.tenant_id = tu.tenant_id
      AND ur.role = tu.role::public.app_role
  )
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.user_can_manage_campaigners_for_tenant(check_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    public.is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.tenant_id = check_tenant_id
        AND ur.role IN ('owner'::public.app_role, 'team_manager'::public.app_role)
    )
    OR EXISTS (
      SELECT 1
      FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid()
        AND tu.tenant_id = check_tenant_id
        AND tu.role IN ('owner', 'agency_owner', 'team_manager')
    );
$$;

CREATE OR REPLACE FUNCTION public.user_can_delete_users_for_tenant(check_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    public.is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.tenant_id = check_tenant_id
        AND ur.role IN ('owner'::public.app_role, 'agency_owner'::public.app_role)
    )
    OR EXISTS (
      SELECT 1
      FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid()
        AND tu.tenant_id = check_tenant_id
        AND tu.role IN ('owner', 'agency_owner')
    );
$$;

GRANT EXECUTE ON FUNCTION public.user_can_manage_campaigners_for_tenant(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_can_delete_users_for_tenant(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Team managers and owners can insert campaigners" ON public.campaigners;
DROP POLICY IF EXISTS "Users can update campaigners in their tenant" ON public.campaigners;
DROP POLICY IF EXISTS "Users can delete campaigners in their tenant" ON public.campaigners;

CREATE POLICY "Team managers and owners can insert campaigners"
ON public.campaigners
FOR INSERT
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR (
    tenant_id = public.get_effective_tenant_id()
    AND public.user_can_manage_campaigners_for_tenant(campaigners.tenant_id)
  )
);

CREATE POLICY "Users can update campaigners in their tenant"
ON public.campaigners
FOR UPDATE
USING (
  public.is_super_admin(auth.uid())
  OR (
    tenant_id = public.get_effective_tenant_id()
    AND public.user_can_manage_campaigners_for_tenant(campaigners.tenant_id)
  )
)
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR (
    tenant_id = public.get_effective_tenant_id()
    AND public.user_can_manage_campaigners_for_tenant(campaigners.tenant_id)
  )
);

CREATE POLICY "Users can delete campaigners in their tenant"
ON public.campaigners
FOR DELETE
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR (
    tenant_id = public.get_effective_tenant_id()
    AND public.user_can_manage_campaigners_for_tenant(campaigners.tenant_id)
  )
);

DROP POLICY IF EXISTS "Users can assign campaigners to accessible agencies" ON public.campaigner_agencies;
DROP POLICY IF EXISTS "Users can delete campaigner_agencies" ON public.campaigner_agencies;
DROP POLICY IF EXISTS "Users can update campaigner_agencies" ON public.campaigner_agencies;

CREATE POLICY "Users can assign campaigners to accessible agencies"
ON public.campaigner_agencies
FOR INSERT
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR (
    public.user_can_manage_campaigners_for_tenant(public.get_effective_tenant_id())
    AND EXISTS (
      SELECT 1
      FROM public.campaigners c
      WHERE c.id = campaigner_agencies.campaigner_id
        AND c.tenant_id = public.get_effective_tenant_id()
    )
    AND (
      agency_id IN (
        SELECT a.id FROM public.agencies a
        WHERE a.tenant_id = public.get_effective_tenant_id()
      )
      OR agency_id IN (
        SELECT ata.agency_id
        FROM public.agency_tenant_access ata
        WHERE ata.accessing_tenant_id = public.get_effective_tenant_id()
          AND ata.access_level = 'read_write'
      )
    )
  )
);

CREATE POLICY "Users can delete campaigner_agencies"
ON public.campaigner_agencies
FOR DELETE
USING (
  public.is_super_admin(auth.uid())
  OR (
    public.user_can_manage_campaigners_for_tenant(public.get_effective_tenant_id())
    AND EXISTS (
      SELECT 1
      FROM public.campaigners c
      WHERE c.id = campaigner_agencies.campaigner_id
        AND c.tenant_id = public.get_effective_tenant_id()
    )
    AND (
      agency_id IN (
        SELECT a.id FROM public.agencies a
        WHERE a.tenant_id = public.get_effective_tenant_id()
      )
      OR agency_id IN (
        SELECT ata.agency_id
        FROM public.agency_tenant_access ata
        WHERE ata.accessing_tenant_id = public.get_effective_tenant_id()
          AND ata.access_level = 'read_write'
      )
    )
  )
);

CREATE POLICY "Users can update campaigner_agencies"
ON public.campaigner_agencies
FOR UPDATE
USING (
  public.is_super_admin(auth.uid())
  OR (
    public.user_can_manage_campaigners_for_tenant(public.get_effective_tenant_id())
    AND EXISTS (
      SELECT 1
      FROM public.campaigners c
      WHERE c.id = campaigner_agencies.campaigner_id
        AND c.tenant_id = public.get_effective_tenant_id()
    )
    AND (
      agency_id IN (
        SELECT a.id FROM public.agencies a
        WHERE a.tenant_id = public.get_effective_tenant_id()
      )
      OR agency_id IN (
        SELECT ata.agency_id
        FROM public.agency_tenant_access ata
        WHERE ata.accessing_tenant_id = public.get_effective_tenant_id()
          AND ata.access_level = 'read_write'
      )
    )
  )
)
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR (
    public.user_can_manage_campaigners_for_tenant(public.get_effective_tenant_id())
    AND EXISTS (
      SELECT 1
      FROM public.campaigners c
      WHERE c.id = campaigner_agencies.campaigner_id
        AND c.tenant_id = public.get_effective_tenant_id()
    )
    AND (
      agency_id IN (
        SELECT a.id FROM public.agencies a
        WHERE a.tenant_id = public.get_effective_tenant_id()
      )
      OR agency_id IN (
        SELECT ata.agency_id
        FROM public.agency_tenant_access ata
        WHERE ata.accessing_tenant_id = public.get_effective_tenant_id()
          AND ata.access_level = 'read_write'
      )
    )
  )
);
