-- WhatsApp group member cache: stores participants enriched with CRM identity.
-- Populated by the get_group_members tool (via GreenAPI getGroupData) and upserted
-- whenever a group message arrives and the sender is resolved to a known contact.
CREATE TABLE IF NOT EXISTS public.wa_group_members (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid        NOT NULL,
  group_chat_id text        NOT NULL,
  phone         text        NOT NULL,           -- last-9-digit normalized phone
  wa_id         text,                           -- raw WhatsApp JID e.g. 972501234567@c.us
  name          text,                           -- WhatsApp display name or CRM name
  contact_type  text        DEFAULT 'unknown',  -- 'campaigner' | 'client' | 'lead' | 'unknown'
  contact_id    uuid,                           -- FK to the matched CRM row
  contact_name  text,                           -- canonical CRM name
  is_admin      boolean     DEFAULT false,
  last_synced_at timestamptz DEFAULT now(),
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  UNIQUE(tenant_id, group_chat_id, phone)
);

ALTER TABLE public.wa_group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wa_group_members_tenant"
  ON public.wa_group_members
  USING (tenant_id = (select (auth.jwt() ->> 'tenant_id')::uuid));

-- Service-role bypass for edge functions (no JWT)
CREATE POLICY "wa_group_members_service"
  ON public.wa_group_members
  TO service_role USING (true) WITH CHECK (true);

-- Efficient lookups by group + phone
CREATE INDEX IF NOT EXISTS wa_group_members_tenant_group_phone
  ON public.wa_group_members (tenant_id, group_chat_id, phone);
CREATE INDEX IF NOT EXISTS wa_group_members_tenant_phone
  ON public.wa_group_members (tenant_id, phone);
