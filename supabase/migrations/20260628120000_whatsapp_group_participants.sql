-- Cache of WhatsApp group participants, synced from GreenAPI getGroupData.
-- Updated on group creation and on demand via the get_group_members tool.
CREATE TABLE IF NOT EXISTS public.whatsapp_group_participants (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id        UUID        NOT NULL REFERENCES public.whatsapp_groups(id) ON DELETE CASCADE,
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  phone_jid       TEXT        NOT NULL,                  -- full JID e.g. 972501234567@c.us
  phone           TEXT        NOT NULL,                  -- digits only, no country prefix normalisation
  display_name    TEXT,                                  -- filled from chat_messages.sender_name on sync
  is_admin        BOOLEAN     NOT NULL DEFAULT false,
  is_super_admin  BOOLEAN     NOT NULL DEFAULT false,
  lead_id         UUID        REFERENCES public.leads(id)    ON DELETE SET NULL,
  client_id       UUID        REFERENCES public.clients(id)  ON DELETE SET NULL,
  last_synced_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(group_id, phone_jid)
);

CREATE INDEX IF NOT EXISTS idx_wgp_group_id   ON public.whatsapp_group_participants(group_id);
CREATE INDEX IF NOT EXISTS idx_wgp_tenant_id  ON public.whatsapp_group_participants(tenant_id);
CREATE INDEX IF NOT EXISTS idx_wgp_phone      ON public.whatsapp_group_participants(phone);
CREATE INDEX IF NOT EXISTS idx_wgp_lead_id    ON public.whatsapp_group_participants(lead_id);
CREATE INDEX IF NOT EXISTS idx_wgp_client_id  ON public.whatsapp_group_participants(client_id);

-- RLS: tenant isolation
ALTER TABLE public.whatsapp_group_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation"
  ON public.whatsapp_group_participants
  FOR ALL
  USING (tenant_id IN (
    SELECT tenant_id FROM public.user_active_tenant WHERE user_id = auth.uid()
  ));
