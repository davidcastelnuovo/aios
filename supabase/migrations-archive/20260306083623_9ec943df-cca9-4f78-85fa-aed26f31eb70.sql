
-- Table for team channel invite links
CREATE TABLE public.team_channel_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid REFERENCES public.team_channels(id) ON DELETE CASCADE NOT NULL,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true
);

-- Enable RLS
ALTER TABLE public.team_channel_invites ENABLE ROW LEVEL SECURITY;

-- Channel members can view invites
CREATE POLICY "Channel members can view invites"
ON public.team_channel_invites FOR SELECT TO authenticated
USING (is_channel_member(channel_id, auth.uid()));

-- Channel admins can create invites
CREATE POLICY "Channel admins can create invites"
ON public.team_channel_invites FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM team_channel_members
    WHERE channel_id = team_channel_invites.channel_id
    AND user_id = auth.uid()
    AND role = 'admin'
  )
);

-- Channel admins can update (deactivate) invites
CREATE POLICY "Channel admins can update invites"
ON public.team_channel_invites FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM team_channel_members
    WHERE channel_id = team_channel_invites.channel_id
    AND user_id = auth.uid()
    AND role = 'admin'
  )
);

-- Allow public read of active invites by token (for invite page)
CREATE POLICY "Anyone can read active invites by token"
ON public.team_channel_invites FOR SELECT TO anon
USING (is_active = true);
