-- Backfill default tenant and restore data visibility after introducing multi-tenant RLS
DO $$
DECLARE
  v_tenant_id uuid;
BEGIN
  -- Ensure at least one tenant exists and capture its id
  SELECT id INTO v_tenant_id
  FROM public.tenants
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    INSERT INTO public.tenants (name, status)
    VALUES ('Default Tenant', 'active')
    RETURNING id INTO v_tenant_id;
  END IF;

  -- Backfill tenant_id on existing data so RLS stops filtering everything out
  UPDATE public.agencies SET tenant_id = v_tenant_id WHERE tenant_id IS NULL;
  UPDATE public.clients SET tenant_id = v_tenant_id WHERE tenant_id IS NULL;
  UPDATE public.leads SET tenant_id = v_tenant_id WHERE tenant_id IS NULL;
  UPDATE public.campaigners SET tenant_id = v_tenant_id WHERE tenant_id IS NULL;
  UPDATE public.sales_people SET tenant_id = v_tenant_id WHERE tenant_id IS NULL;
  UPDATE public.suppliers SET tenant_id = v_tenant_id WHERE tenant_id IS NULL;
  UPDATE public.tasks SET tenant_id = v_tenant_id WHERE tenant_id IS NULL;
  UPDATE public.finance SET tenant_id = v_tenant_id WHERE tenant_id IS NULL;
  UPDATE public.client_onboarding SET tenant_id = v_tenant_id WHERE tenant_id IS NULL;
  UPDATE public.time_entries SET tenant_id = v_tenant_id WHERE tenant_id IS NULL;

  -- Link all existing users to this tenant to satisfy get_user_tenant_id()
  INSERT INTO public.tenant_users (user_id, tenant_id, role)
  SELECT u.id, v_tenant_id,
         CASE WHEN EXISTS (
           SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id AND ur.role::text = 'owner'
         ) THEN 'owner' ELSE 'member' END
  FROM auth.users u
  WHERE NOT EXISTS (
    SELECT 1 FROM public.tenant_users tu WHERE tu.user_id = u.id AND tu.tenant_id = v_tenant_id
  );
END $$;