-- Safe prod backfill for campaigners with NULL tenant_id on user_roles.

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

-- Default report/dashboard module access for DMM campaigners missing it.
INSERT INTO public.user_permissions (user_id, module, can_access)
SELECT ur.user_id, module_name, true
FROM public.user_roles ur
CROSS JOIN (VALUES ('dynamic_tables'), ('reports')) AS modules(module_name)
WHERE ur.tenant_id = '6ad8f321-25db-4a04-8e44-e57a7c8961b2'
  AND ur.role = 'campaigner'::app_role
  AND NOT EXISTS (
    SELECT 1
    FROM public.user_permissions up
    WHERE up.user_id = ur.user_id
      AND up.module = modules.module_name
  );

INSERT INTO public.claude_carmen_audit (actor, action, target, details)
VALUES (
  'claude',
  'campaigner_access_repair',
  'tenant:dmm',
  jsonb_build_object(
    'fix', 'backfill user_roles.tenant_id + campaigner dynamic_tables/reports permissions',
    'ops_script', 'fix_dmm_campaigner_role_tenant_scope.sql'
  )
);
