-- Broadcast (דיוור) module — Phase 1: WhatsApp (unofficial: Green API / Manus)
-- Tables: broadcasts (the message + audience + schedule), broadcast_recipients
-- (per-recipient snapshot + send status), broadcast_opt_outs (do-not-contact list).
-- Email (Resend) and official WhatsApp templates are intentionally out of scope here.

-- ─────────────────────────────────────────────────────────────────────────────
-- broadcasts
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.broadcasts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  created_by UUID,
  name TEXT NOT NULL DEFAULT 'דיוור חדש',
  channel TEXT NOT NULL DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp', 'email')),
  provider TEXT NOT NULL CHECK (provider IN ('green_api', 'manus_wa', 'resend')),
  integration_id UUID,           -- FK-ish to tenant_integrations (which connection sends)
  body_text TEXT,                -- message body, supports {{variables}}
  media_url TEXT,                -- optional image (Supabase Storage public URL)
  subject TEXT,                  -- email only
  audience_filter JSONB NOT NULL DEFAULT '{}'::jsonb,  -- { source, statuses, statusKeys, tagIds, ... }
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'paused', 'failed', 'canceled')),
  scheduled_at TIMESTAMPTZ,      -- when to start sending; null = send now once started
  timezone TEXT NOT NULL DEFAULT 'Asia/Jerusalem',
  throttle_min_seconds INTEGER NOT NULL DEFAULT 12,  -- min gap between sends (anti-ban)
  throttle_max_seconds INTEGER NOT NULL DEFAULT 20,  -- max gap (jitter)
  daily_cap INTEGER NOT NULL DEFAULT 300,            -- max sends per day for this broadcast
  stats JSONB NOT NULL DEFAULT '{}'::jsonb,          -- {total, sent, delivered, failed, opted_out}
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_broadcasts_tenant ON public.broadcasts(tenant_id);
CREATE INDEX idx_broadcasts_due ON public.broadcasts(scheduled_at)
  WHERE status IN ('scheduled', 'sending');

GRANT SELECT, INSERT, UPDATE, DELETE ON public.broadcasts TO authenticated;
GRANT ALL ON public.broadcasts TO service_role;

ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "broadcasts_tenant_select" ON public.broadcasts
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_effective_tenant_id() OR public.is_super_admin(auth.uid()));

CREATE POLICY "broadcasts_tenant_insert" ON public.broadcasts
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_effective_tenant_id() OR public.is_super_admin(auth.uid()));

CREATE POLICY "broadcasts_tenant_update" ON public.broadcasts
  FOR UPDATE TO authenticated
  USING (tenant_id = public.get_effective_tenant_id() OR public.is_super_admin(auth.uid()))
  WITH CHECK (tenant_id = public.get_effective_tenant_id() OR public.is_super_admin(auth.uid()));

CREATE POLICY "broadcasts_tenant_delete" ON public.broadcasts
  FOR DELETE TO authenticated
  USING (tenant_id = public.get_effective_tenant_id() OR public.is_super_admin(auth.uid()));

CREATE TRIGGER trg_broadcasts_updated_at
  BEFORE UPDATE ON public.broadcasts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─────────────────────────────────────────────────────────────────────────────
-- broadcast_recipients — frozen snapshot of who gets the message + per-send state
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.broadcast_recipients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  broadcast_id UUID NOT NULL REFERENCES public.broadcasts(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('client', 'lead', 'campaigner', 'manual')),
  entity_id UUID,
  phone TEXT,
  email TEXT,
  contact_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed', 'opted_out', 'skipped')),
  provider_message_id TEXT,
  error TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_br_broadcast ON public.broadcast_recipients(broadcast_id);
CREATE INDEX idx_br_tenant ON public.broadcast_recipients(tenant_id);
CREATE INDEX idx_br_pending ON public.broadcast_recipients(broadcast_id, status) WHERE status = 'pending';
-- Avoid sending the same broadcast twice to the same phone/email
CREATE UNIQUE INDEX uq_br_broadcast_phone ON public.broadcast_recipients(broadcast_id, phone)
  WHERE phone IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.broadcast_recipients TO authenticated;
GRANT ALL ON public.broadcast_recipients TO service_role;

ALTER TABLE public.broadcast_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "br_tenant_select" ON public.broadcast_recipients
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_effective_tenant_id() OR public.is_super_admin(auth.uid()));

CREATE POLICY "br_tenant_insert" ON public.broadcast_recipients
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_effective_tenant_id() OR public.is_super_admin(auth.uid()));

CREATE POLICY "br_tenant_update" ON public.broadcast_recipients
  FOR UPDATE TO authenticated
  USING (tenant_id = public.get_effective_tenant_id() OR public.is_super_admin(auth.uid()))
  WITH CHECK (tenant_id = public.get_effective_tenant_id() OR public.is_super_admin(auth.uid()));

CREATE POLICY "br_tenant_delete" ON public.broadcast_recipients
  FOR DELETE TO authenticated
  USING (tenant_id = public.get_effective_tenant_id() OR public.is_super_admin(auth.uid()));

CREATE TRIGGER trg_br_updated_at
  BEFORE UPDATE ON public.broadcast_recipients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─────────────────────────────────────────────────────────────────────────────
-- broadcast_opt_outs — per-tenant do-not-contact list (legal compliance)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.broadcast_opt_outs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  phone TEXT,
  email TEXT,
  channel TEXT NOT NULL DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp', 'email', 'all')),
  reason TEXT,
  source TEXT,            -- e.g. 'reply_stop', 'manual', 'email_unsubscribe'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_optout_tenant ON public.broadcast_opt_outs(tenant_id);
CREATE UNIQUE INDEX uq_optout_phone ON public.broadcast_opt_outs(tenant_id, phone, channel)
  WHERE phone IS NOT NULL;
CREATE UNIQUE INDEX uq_optout_email ON public.broadcast_opt_outs(tenant_id, email, channel)
  WHERE email IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.broadcast_opt_outs TO authenticated;
GRANT ALL ON public.broadcast_opt_outs TO service_role;

ALTER TABLE public.broadcast_opt_outs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "optout_tenant_select" ON public.broadcast_opt_outs
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_effective_tenant_id() OR public.is_super_admin(auth.uid()));

CREATE POLICY "optout_tenant_insert" ON public.broadcast_opt_outs
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_effective_tenant_id() OR public.is_super_admin(auth.uid()));

CREATE POLICY "optout_tenant_delete" ON public.broadcast_opt_outs
  FOR DELETE TO authenticated
  USING (tenant_id = public.get_effective_tenant_id() OR public.is_super_admin(auth.uid()));

-- ─────────────────────────────────────────────────────────────────────────────
-- broadcast-media storage bucket (PUBLIC — WhatsApp providers fetch images by URL)
-- Object path convention: {tenant_id}/{filename}
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('broadcast-media', 'broadcast-media', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "broadcast media public read" ON storage.objects;
DROP POLICY IF EXISTS "broadcast media tenant upload" ON storage.objects;
DROP POLICY IF EXISTS "broadcast media tenant delete" ON storage.objects;

CREATE POLICY "broadcast media public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'broadcast-media');

CREATE POLICY "broadcast media tenant upload"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'broadcast-media'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = public.get_user_tenant_id(auth.uid())::text
);

CREATE POLICY "broadcast media tenant delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'broadcast-media'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = public.get_user_tenant_id(auth.uid())::text
);
