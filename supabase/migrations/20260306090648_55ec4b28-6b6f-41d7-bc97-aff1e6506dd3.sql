
-- 1. Add tenant_id to team_channel_members
ALTER TABLE public.team_channel_members 
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);

-- 2. Backfill tenant_id from team_channels
UPDATE public.team_channel_members tcm
SET tenant_id = tc.tenant_id
FROM public.team_channels tc
WHERE tcm.channel_id = tc.id AND tcm.tenant_id IS NULL;

-- 3. Make tenant_id NOT NULL after backfill
ALTER TABLE public.team_channel_members 
  ALTER COLUMN tenant_id SET NOT NULL;

-- 4. Update is_channel_member to scope by tenant
CREATE OR REPLACE FUNCTION public.is_channel_member(p_channel_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_channel_members
    WHERE channel_id = p_channel_id 
      AND user_id = p_user_id
      AND tenant_id = get_user_tenant_id(p_user_id)
  )
$$;

-- 5. Update team_channels SELECT policy to enforce tenant
DROP POLICY IF EXISTS "Members can view their channels" ON public.team_channels;
CREATE POLICY "Members can view their channels" ON public.team_channels
  FOR SELECT TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid()) 
    AND (is_channel_member(id, auth.uid()) OR is_super_admin(auth.uid()))
  );

-- 6. Update team_channel_members SELECT policy to enforce tenant
DROP POLICY IF EXISTS "Members can view channel members" ON public.team_channel_members;
CREATE POLICY "Members can view channel members" ON public.team_channel_members
  FOR SELECT TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
  );

-- 7. Update team_channel_members INSERT policy
DROP POLICY IF EXISTS "Channel admins can add members" ON public.team_channel_members;
CREATE POLICY "Channel admins can add members" ON public.team_channel_members
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = get_user_tenant_id(auth.uid())
  );

-- 8. Ensure anon can read team_channel_invites for the invite page
DROP POLICY IF EXISTS "Anyone can view active invites by token" ON public.team_channel_invites;
CREATE POLICY "Anyone can view active invites by token" ON public.team_channel_invites
  FOR SELECT TO anon, authenticated
  USING (is_active = true);
