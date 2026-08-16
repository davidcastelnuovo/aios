-- Campaigners in DMM (and elsewhere) lost client/report access when user_roles.tenant_id
-- was left NULL after invite/migration. has_role() only matches tenant_id =
-- get_user_tenant_id(), so those users fail get_user_client_ids() and RLS everywhere.

-- 1) Remove duplicate global role rows when a tenant-scoped row already exists.
DELETE FROM public.user_roles ur_null
WHERE ur_null.tenant_id IS NULL
  AND ur_null.role <> 'super_admin'
  AND EXISTS (
    SELECT 1
    FROM public.user_roles ur_scoped
    WHERE ur_scoped.user_id = ur_null.user_id
      AND ur_scoped.role = ur_null.role
      AND ur_scoped.tenant_id IS NOT NULL
  );

-- 2) Backfill tenant_id on remaining legacy/global role rows from tenant_users.
UPDATE public.user_roles ur
SET tenant_id = matched.tenant_id
FROM (
  SELECT DISTINCT ON (ur_inner.id)
    ur_inner.id AS role_row_id,
    tu.tenant_id
  FROM public.user_roles ur_inner
  JOIN public.tenant_users tu
    ON tu.user_id = ur_inner.user_id
   AND tu.role::text = ur_inner.role::text
  WHERE ur_inner.tenant_id IS NULL
    AND ur_inner.role <> 'super_admin'
  ORDER BY ur_inner.id, tu.created_at NULLS LAST
) AS matched
WHERE ur.id = matched.role_row_id
  AND ur.tenant_id IS NULL;

-- 2) has_role: honor active tenant, and fall back to tenant_users when role rows
-- are still global (tenant_id IS NULL) for the active org.
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
        OR ur.tenant_id = public.get_user_tenant_id(_user_id)
        OR (
          ur.tenant_id IS NULL
          AND EXISTS (
            SELECT 1
            FROM public.tenant_users tu
            WHERE tu.user_id = _user_id
              AND tu.tenant_id = public.get_user_tenant_id(_user_id)
              AND tu.role::text = _role::text
          )
        )
      )
  )
$$;
