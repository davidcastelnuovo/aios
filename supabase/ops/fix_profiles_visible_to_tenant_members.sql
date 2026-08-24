-- Applied via .github/workflows/apply-sql-migration.yml (Management API).
-- Source of truth also lives in:
--   supabase/migrations/20260823160000_fix_profiles_visible_to_tenant_members.sql

-- Restore the intent of "Users can view profiles in their tenant".
--
-- The policy resolves co-members through `tenant_users`, but that table is
-- itself protected by RLS: a non-owner only sees their own row ("Users see own
-- tenant_users"). The sub-select therefore collapses to the viewer, so a
-- campaigner can read exactly one profile — their own. Every author line that
-- reads a name through `profiles` (client updates, lead updates, task updates,
-- chat) then renders the generic "משתמש" fallback for everybody else.
--
-- Resolving co-membership inside a SECURITY DEFINER helper skips the RLS on
-- `tenant_users` for that lookup only. Visibility stays exactly what the policy
-- already promised: users who share a tenant with the viewer. No new tenant,
-- role or column is exposed.

CREATE OR REPLACE FUNCTION public.user_shares_tenant_with(_viewer uuid, _target uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_users viewer_tu
    JOIN public.tenant_users target_tu
      ON target_tu.tenant_id = viewer_tu.tenant_id
    WHERE viewer_tu.user_id = _viewer
      AND target_tu.user_id = _target
  );
$$;

GRANT EXECUTE ON FUNCTION public.user_shares_tenant_with(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "Users can view profiles in their tenant" ON public.profiles;

CREATE POLICY "Users can view profiles in their tenant" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.user_shares_tenant_with((SELECT auth.uid()), id));
