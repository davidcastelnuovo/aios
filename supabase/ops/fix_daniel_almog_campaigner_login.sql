-- Daniel Almog (almog619@gmail.com) could sign in but had no app access.
-- Root cause: provisioning lived on an orphan profile (c0d9e82a-...) while Google
-- OAuth auth user is a7318652-... — same email, different UUIDs.

DO $$
DECLARE
  v_auth_user uuid := 'a7318652-96b6-4069-8a8f-abafd4bf74a0';
  v_orphan_user uuid := 'c0d9e82a-8394-4786-a790-f9a5fbf8fc98';
  v_tenant uuid := '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019';
  v_campaigner uuid := '72724ffd-1ae2-4030-a86c-183a03f1bdff';
BEGIN
  -- Ensure profile exists on the real auth user id.
  INSERT INTO public.profiles (
    id, email, full_name, status, campaigner_id, ui_mode, created_at, updated_at
  )
  SELECT
    v_auth_user,
    p.email,
    p.full_name,
    'active',
    COALESCE(p.campaigner_id, v_campaigner),
    COALESCE(p.ui_mode, 'classic'),
    COALESCE(p.created_at, now()),
    now()
  FROM public.profiles p
  WHERE p.id = v_orphan_user
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    status = 'active',
    campaigner_id = COALESCE(public.profiles.campaigner_id, EXCLUDED.campaigner_id),
    updated_at = now();

  -- Tenant membership + role + permissions.
  INSERT INTO public.tenant_users (user_id, tenant_id, role)
  SELECT v_auth_user, tu.tenant_id, tu.role
  FROM public.tenant_users tu
  WHERE tu.user_id = v_orphan_user
  ON CONFLICT DO NOTHING;

  INSERT INTO public.user_roles (user_id, role, tenant_id)
  SELECT v_auth_user, ur.role, ur.tenant_id
  FROM public.user_roles ur
  WHERE ur.user_id = v_orphan_user
  ON CONFLICT (user_id, role, tenant_id) DO NOTHING;

  INSERT INTO public.user_permissions (user_id, module, can_access)
  SELECT v_auth_user, up.module, up.can_access
  FROM public.user_permissions up
  WHERE up.user_id = v_orphan_user
  ON CONFLICT (user_id, module) DO UPDATE
    SET can_access = EXCLUDED.can_access;

  INSERT INTO public.user_active_tenant (user_id, tenant_id, updated_at)
  VALUES (v_auth_user, v_tenant, now())
  ON CONFLICT (user_id) DO UPDATE
    SET tenant_id = EXCLUDED.tenant_id,
        updated_at = now();

  -- Remove orphan provisioning rows.
  DELETE FROM public.user_permissions WHERE user_id = v_orphan_user;
  DELETE FROM public.user_roles WHERE user_id = v_orphan_user;
  DELETE FROM public.tenant_users WHERE user_id = v_orphan_user;
  DELETE FROM public.profiles WHERE id = v_orphan_user;
END $$;

INSERT INTO public.claude_carmen_audit (actor, action, target, details)
VALUES (
  'claude',
  'fix_campaigner_login',
  'almog619@gmail.com',
  jsonb_build_object(
    'auth_user_id', 'a7318652-96b6-4069-8a8f-abafd4bf74a0',
    'orphan_profile_id', 'c0d9e82a-8394-4786-a790-f9a5fbf8fc98',
    'campaigner_id', '72724ffd-1ae2-4030-a86c-183a03f1bdff',
    'tenant_id', '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019',
    'reason', 'Google OAuth auth user id did not match orphan profile id with all provisioning'
  )
);
