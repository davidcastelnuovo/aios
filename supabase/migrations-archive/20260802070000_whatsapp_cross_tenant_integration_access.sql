-- An integration remains owned by exactly one tenant. Other tenants may use it only
-- through an explicit row in integration_tenant_access; credentials are never copied.
CREATE OR REPLACE FUNCTION public.tenant_can_use_integration(
  p_tenant_id uuid,
  p_integration_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_integrations ti
    WHERE ti.id = p_integration_id
      AND ti.is_active = true
      AND (
        ti.tenant_id = p_tenant_id
        OR EXISTS (
          SELECT 1
          FROM public.integration_tenant_access ita
          WHERE ita.integration_id = ti.id
            AND ita.accessing_tenant_id = p_tenant_id
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.tenant_can_use_integration(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tenant_can_use_integration(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tenant_can_use_integration(uuid, uuid) TO service_role;

-- Let a tenant member see the non-secret integration metadata for a connection that
-- was explicitly shared with their tenant. Secret/token tables remain service-role only.
DROP POLICY IF EXISTS "Tenant members can view explicitly shared integrations"
  ON public.tenant_integrations;
CREATE POLICY "Tenant members can view explicitly shared integrations"
ON public.tenant_integrations
FOR SELECT
TO authenticated
USING (
  public.tenant_can_use_integration(
    public.get_user_tenant_id(auth.uid()),
    id
  )
);

DROP POLICY IF EXISTS "Tenant members can view messages from explicitly shared integrations"
  ON public.chat_messages;
CREATE POLICY "Tenant members can view messages from explicitly shared integrations"
ON public.chat_messages
FOR SELECT
TO authenticated
USING (
  tenant_id = public.get_user_tenant_id(auth.uid())
  AND COALESCE(is_blocked, false) = false
  AND integration_id IS NOT NULL
  AND public.tenant_can_use_integration(tenant_id, integration_id)
);

-- The original ALL policy had no explicit WITH CHECK. Keep sharing owner-controlled
-- and prevent inserting a grant for an integration outside the owner's active tenant.
DROP POLICY IF EXISTS "Owners can manage integration sharing"
  ON public.integration_tenant_access;
CREATE POLICY "Owners can manage integration sharing"
ON public.integration_tenant_access
FOR ALL
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.tenant_integrations ti
    WHERE ti.id = integration_id
      AND ti.tenant_id = public.get_user_tenant_id(auth.uid())
      AND public.has_role(auth.uid(), 'owner'::public.app_role)
  )
)
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.tenant_integrations ti
    WHERE ti.id = integration_id
      AND ti.tenant_id = public.get_user_tenant_id(auth.uid())
      AND public.has_role(auth.uid(), 'owner'::public.app_role)
  )
);

CREATE INDEX IF NOT EXISTS idx_integration_tenant_access_tenant_integration
  ON public.integration_tenant_access(accessing_tenant_id, integration_id);
