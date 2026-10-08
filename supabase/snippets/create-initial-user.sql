DO $$
DECLARE
  local_user_id uuid;
  local_tenant_id uuid;
BEGIN
  SELECT id INTO local_user_id
  FROM auth.users
  WHERE email = 'chiptus@gmail.com';

  IF local_user_id IS NULL THEN
    RAISE EXCEPTION 'Create the local Auth user first';
  END IF;

  SELECT id INTO local_tenant_id
  FROM public.tenants
  WHERE slug = 'local-dev';

  IF local_tenant_id IS NULL THEN
    INSERT INTO public.tenants (name, slug)
    VALUES ('Local Development', 'local-dev')
    RETURNING id INTO local_tenant_id;
  END IF;

  INSERT INTO public.tenant_users (tenant_id, user_id, role)
  VALUES (local_tenant_id, local_user_id, 'owner')
  ON CONFLICT (tenant_id, user_id)
  DO UPDATE SET role = 'owner';

  INSERT INTO public.user_roles (user_id, role, tenant_id)
  VALUES (local_user_id, 'owner', local_tenant_id)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.user_active_tenant (user_id, tenant_id)
  VALUES (local_user_id, local_tenant_id)
  ON CONFLICT (user_id)
  DO UPDATE SET tenant_id = EXCLUDED.tenant_id;
END $$;