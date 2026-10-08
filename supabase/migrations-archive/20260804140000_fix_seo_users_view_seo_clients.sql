-- SEO app_role users must see all SEO-tagged clients in their active tenant.
-- Fixes: legacy user_roles.tenant_id NULL, jsonb services check, effective tenant id.

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role = _role
      AND (
        (_role = 'super_admin' AND ur.tenant_id IS NULL)
        OR (
          _role != 'super_admin'
          AND (
            ur.tenant_id = public.get_effective_tenant_id()
            OR ur.tenant_id = public.get_user_tenant_id(_user_id)
            OR (
              ur.tenant_id IS NULL
              AND EXISTS (
                SELECT 1
                FROM public.tenant_users tu
                WHERE tu.user_id = _user_id
                  AND tu.tenant_id = public.get_effective_tenant_id()
              )
            )
          )
        )
      )
  )
$$;

DROP POLICY IF EXISTS "SEO users view SEO-tagged clients" ON public.clients;

CREATE POLICY "SEO users view SEO-tagged clients"
ON public.clients
FOR SELECT
USING (
  public.has_role(auth.uid(), 'seo'::app_role)
  AND (
    is_seo_client = true
    OR services @> '["seo"]'::jsonb
  )
  AND (
    tenant_id = public.get_effective_tenant_id()
    OR public.user_has_cross_tenant_agency_access(auth.uid(), agency_id)
  )
);

COMMENT ON POLICY "SEO users view SEO-tagged clients" ON public.clients IS
  'Users with seo app_role see every SEO-tagged client in the active tenant (and shared agencies).';
