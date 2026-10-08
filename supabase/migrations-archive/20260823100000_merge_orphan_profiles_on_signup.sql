-- When a user signs up (Google OAuth / email), merge provisioning from an older
-- orphan profile that shares the same email but a different UUID. This prevents
-- "can sign in but sees no clients / no org" when invite provisioning predates
-- the real auth.users row (e.g. Daniel Almog, almog619@gmail.com).

CREATE OR REPLACE FUNCTION public.merge_orphan_profile_by_email(
  _auth_user_id uuid,
  _email text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_orphan_id uuid;
BEGIN
  IF _auth_user_id IS NULL OR NULLIF(trim(_email), '') IS NULL THEN
    RETURN;
  END IF;

  SELECT p.id
  INTO v_orphan_id
  FROM public.profiles p
  WHERE lower(p.email) = lower(_email)
    AND p.id <> _auth_user_id
    AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.id)
  ORDER BY p.updated_at DESC NULLS LAST, p.created_at DESC
  LIMIT 1;

  IF v_orphan_id IS NULL THEN
    RETURN;
  END IF;

  -- Copy team-member links onto the real auth profile.
  UPDATE public.profiles dst
  SET
    full_name = COALESCE(NULLIF(dst.full_name, ''), src.full_name),
    campaigner_id = COALESCE(dst.campaigner_id, src.campaigner_id),
    sales_person_id = COALESCE(dst.sales_person_id, src.sales_person_id),
    phone = COALESCE(dst.phone, src.phone),
    avatar_url = COALESCE(dst.avatar_url, src.avatar_url),
    ui_mode = COALESCE(dst.ui_mode, src.ui_mode),
    status = 'active',
    updated_at = now()
  FROM public.profiles src
  WHERE dst.id = _auth_user_id
    AND src.id = v_orphan_id;

  INSERT INTO public.tenant_users (user_id, tenant_id, role)
  SELECT _auth_user_id, tu.tenant_id, tu.role
  FROM public.tenant_users tu
  WHERE tu.user_id = v_orphan_id
  ON CONFLICT (tenant_id, user_id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role, tenant_id)
  SELECT _auth_user_id, ur.role, ur.tenant_id
  FROM public.user_roles ur
  WHERE ur.user_id = v_orphan_id
  ON CONFLICT (user_id, role, tenant_id) DO NOTHING;

  INSERT INTO public.user_permissions (user_id, module, can_access)
  SELECT _auth_user_id, up.module, up.can_access
  FROM public.user_permissions up
  WHERE up.user_id = v_orphan_id
  ON CONFLICT (user_id, module) DO UPDATE
    SET can_access = EXCLUDED.can_access;

  INSERT INTO public.user_active_tenant (user_id, tenant_id, updated_at)
  SELECT _auth_user_id, uat.tenant_id, now()
  FROM public.user_active_tenant uat
  WHERE uat.user_id = v_orphan_id
  ON CONFLICT (user_id) DO NOTHING;

  DELETE FROM public.user_permissions WHERE user_id = v_orphan_id;
  DELETE FROM public.user_roles WHERE user_id = v_orphan_id;
  DELETE FROM public.tenant_users WHERE user_id = v_orphan_id;
  DELETE FROM public.user_active_tenant WHERE user_id = v_orphan_id;
  DELETE FROM public.profiles WHERE id = v_orphan_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_inv    public.invitation_tokens%ROWTYPE;
  v_meta   jsonb;
  v_role   text;
  v_tenant uuid;
BEGIN
  INSERT INTO public.profiles (id, email, full_name, status)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), 'active')
  ON CONFLICT (id) DO NOTHING;

  -- Merge any pre-provisioned orphan profile with the same email.
  BEGIN
    PERFORM public.merge_orphan_profile_by_email(NEW.id, NEW.email);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user orphan merge failed for %: %', NEW.email, SQLERRM;
  END;

  BEGIN
    SELECT * INTO v_inv
    FROM public.invitation_tokens
    WHERE lower(email) = lower(NEW.email)
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_inv.id IS NOT NULL AND v_inv.tenant_id IS NOT NULL THEN
      v_meta   := COALESCE(v_inv.metadata, '{}'::jsonb);
      v_role   := NULLIF(v_meta->>'role', '');
      v_tenant := v_inv.tenant_id;

      INSERT INTO public.tenant_users (user_id, tenant_id, role)
      SELECT NEW.id, v_tenant, COALESCE(v_role, 'member')
      WHERE NOT EXISTS (
        SELECT 1 FROM public.tenant_users
        WHERE user_id = NEW.id AND tenant_id = v_tenant
      );

      INSERT INTO public.user_active_tenant (user_id, tenant_id)
      SELECT NEW.id, v_tenant
      WHERE NOT EXISTS (
        SELECT 1 FROM public.user_active_tenant WHERE user_id = NEW.id
      );

      IF v_role IS NOT NULL THEN
        BEGIN
          INSERT INTO public.user_roles (user_id, role, tenant_id)
          VALUES (NEW.id, v_role::public.app_role, v_tenant)
          ON CONFLICT (user_id, role, tenant_id) DO NOTHING;
        EXCEPTION WHEN OTHERS THEN
          RAISE WARNING 'handle_new_user: bad role % for %: %', v_role, NEW.email, SQLERRM;
        END;
      END IF;

      IF jsonb_typeof(v_meta->'modulePermissions') = 'array' THEN
        INSERT INTO public.user_permissions (user_id, module, can_access)
        SELECT NEW.id, m.value, true
        FROM jsonb_array_elements_text(v_meta->'modulePermissions') AS m(value)
        WHERE NOT EXISTS (
          SELECT 1 FROM public.user_permissions up
          WHERE up.user_id = NEW.id AND up.module = m.value
        );
      END IF;

      IF NULLIF(v_meta->>'campaignerId', '') IS NOT NULL THEN
        UPDATE public.profiles SET campaigner_id = (v_meta->>'campaignerId')::uuid WHERE id = NEW.id;
      END IF;
      IF NULLIF(v_meta->>'salesPersonId', '') IS NOT NULL THEN
        UPDATE public.profiles SET sales_person_id = (v_meta->>'salesPersonId')::uuid WHERE id = NEW.id;
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user auto-link failed for %: %', NEW.email, SQLERRM;
  END;

  RETURN NEW;
END;
$function$;
