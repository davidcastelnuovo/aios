-- Auto-provision self-signups from a matching invitation.
--
-- Problem: the on_auth_user_created trigger (handle_new_user) only created a
-- profile. Users who signed up directly (not by clicking the invite link) got
-- no tenant membership and no role, so get_user_tenant_id() returned NULL and
-- they were locked out with "no organization" (e.g. Daniel, Felix).
--
-- Fix: when a new auth user is created, if there is a pending invitation for the
-- same email (invitation_tokens — their "prior user" record), link them into
-- that org: tenant membership, active tenant, role, module permissions, and any
-- campaigner/sales-person link — mirroring what invite-user provisions. The
-- linking is best-effort and fully wrapped in an exception block so a
-- provisioning error can NEVER block account creation.

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
  -- Always ensure a profile exists (original behavior).
  INSERT INTO public.profiles (id, email, full_name, status)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), 'active')
  ON CONFLICT (id) DO NOTHING;

  -- Best-effort: link the signup to a pending invitation for the same email.
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

      -- Tenant membership.
      INSERT INTO public.tenant_users (user_id, tenant_id, role)
      SELECT NEW.id, v_tenant, COALESCE(v_role, 'member')
      WHERE NOT EXISTS (
        SELECT 1 FROM public.tenant_users
        WHERE user_id = NEW.id AND tenant_id = v_tenant
      );

      -- Active tenant.
      INSERT INTO public.user_active_tenant (user_id, tenant_id)
      SELECT NEW.id, v_tenant
      WHERE NOT EXISTS (
        SELECT 1 FROM public.user_active_tenant WHERE user_id = NEW.id
      );

      -- App role (skip silently if the invite role isn't a valid app_role).
      IF v_role IS NOT NULL THEN
        BEGIN
          INSERT INTO public.user_roles (user_id, role, tenant_id)
          VALUES (NEW.id, v_role::public.app_role, v_tenant)
          ON CONFLICT (user_id, role, tenant_id) DO NOTHING;
        EXCEPTION WHEN OTHERS THEN
          RAISE WARNING 'handle_new_user: bad role % for %: %', v_role, NEW.email, SQLERRM;
        END;
      END IF;

      -- Module permissions from invite metadata.
      IF jsonb_typeof(v_meta->'modulePermissions') = 'array' THEN
        INSERT INTO public.user_permissions (user_id, module, can_access)
        SELECT NEW.id, m.value, true
        FROM jsonb_array_elements_text(v_meta->'modulePermissions') AS m(value)
        WHERE NOT EXISTS (
          SELECT 1 FROM public.user_permissions up
          WHERE up.user_id = NEW.id AND up.module = m.value
        );
      END IF;

      -- Optional campaigner / sales-person links.
      IF NULLIF(v_meta->>'campaignerId', '') IS NOT NULL THEN
        UPDATE public.profiles SET campaigner_id = (v_meta->>'campaignerId')::uuid WHERE id = NEW.id;
      END IF;
      IF NULLIF(v_meta->>'salesPersonId', '') IS NOT NULL THEN
        UPDATE public.profiles SET sales_person_id = (v_meta->>'salesPersonId')::uuid WHERE id = NEW.id;
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Never block account creation on a provisioning error.
    RAISE WARNING 'handle_new_user auto-link failed for %: %', NEW.email, SQLERRM;
  END;

  RETURN NEW;
END;
$function$;
