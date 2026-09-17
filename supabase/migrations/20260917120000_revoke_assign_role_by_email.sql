-- F02: close the legacy assign_role_by_email RPC.
-- SECURITY DEFINER + EXECUTE for anon/authenticated could grant any app_role,
-- including super_admin, with only an email. Do not "fix" ON CONFLICT — revoke
-- client execute and retire the body so a restored GRANT cannot elevate.

DO $$
BEGIN
  IF to_regprocedure('public.assign_role_by_email(text, app_role)') IS NULL THEN
    RETURN;
  END IF;

  REVOKE ALL ON FUNCTION public.assign_role_by_email(text, app_role) FROM PUBLIC;
  REVOKE ALL ON FUNCTION public.assign_role_by_email(text, app_role) FROM anon;
  REVOKE ALL ON FUNCTION public.assign_role_by_email(text, app_role) FROM authenticated;
END
$$;

CREATE OR REPLACE FUNCTION public.assign_role_by_email(_email text, _role app_role)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'assign_role_by_email is retired'
    USING ERRCODE = '42501';
END;
$$;

REVOKE ALL ON FUNCTION public.assign_role_by_email(text, app_role) FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.assign_role_by_email(text, app_role) IS
  'Retired 2026-09-17. EXECUTE revoked from anon/authenticated. Do not restore client grants.';
