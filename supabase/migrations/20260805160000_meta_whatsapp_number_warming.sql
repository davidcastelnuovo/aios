-- Meta WhatsApp number warming / lead opt-in campaigns.
-- Controlled admin sends of an APPROVED opt-in template + inbound auto-reply.

CREATE TABLE IF NOT EXISTS public.wa_warm_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  integration_id uuid NOT NULL REFERENCES public.tenant_integrations(id) ON DELETE CASCADE,
  created_by uuid,
  name text NOT NULL DEFAULT 'חימום מספר לידים',
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'confirmed', 'running', 'paused', 'completed', 'canceled', 'failed')),
  optin_template_name text NOT NULL DEFAULT 'lead_optin_confirm_he',
  optin_template_language text NOT NULL DEFAULT 'he',
  thanks_text text NOT NULL DEFAULT
    'תודה שפניתם אלינו. זהו מספר טלפון לשליחת לידים ועדכונים. תודה שאישרתם קבלת לידים.',
  audience_source text NOT NULL DEFAULT 'prior_meta_chats'
    CHECK (audience_source IN ('prior_meta_chats', 'clients_with_phone', 'manual')),
  audience_filter jsonb NOT NULL DEFAULT '{}'::jsonb,
  throttle_min_seconds integer NOT NULL DEFAULT 25,
  throttle_max_seconds integer NOT NULL DEFAULT 45,
  daily_cap integer NOT NULL DEFAULT 80,
  admin_confirmed_at timestamptz,
  admin_confirm_phrase text,
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_error text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wa_warm_campaigns_tenant
  ON public.wa_warm_campaigns(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_warm_campaigns_running
  ON public.wa_warm_campaigns(status)
  WHERE status IN ('confirmed', 'running');

CREATE TABLE IF NOT EXISTS public.wa_warm_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.wa_warm_campaigns(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  phone text NOT NULL,
  contact_name text,
  entity_type text CHECK (entity_type IN ('client', 'lead', 'chat', 'manual')),
  entity_id uuid,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending', 'sent', 'delivered', 'read', 'failed', 'skipped',
      'opted_in', 'thanked'
    )),
  provider_message_id text,
  error text,
  attempts integer NOT NULL DEFAULT 0,
  sent_at timestamptz,
  replied_at timestamptz,
  opted_in_at timestamptz,
  thanked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_wa_warm_recipients_campaign_phone
  ON public.wa_warm_recipients(campaign_id, phone);
CREATE INDEX IF NOT EXISTS idx_wa_warm_recipients_pending
  ON public.wa_warm_recipients(campaign_id, status)
  WHERE status = 'pending';

-- Cross-campaign opt-in registry per Meta integration (dedup + inbound thanks).
CREATE TABLE IF NOT EXISTS public.wa_warm_opt_ins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  integration_id uuid NOT NULL REFERENCES public.tenant_integrations(id) ON DELETE CASCADE,
  phone text NOT NULL,
  contact_name text,
  source text NOT NULL DEFAULT 'button'
    CHECK (source IN ('button', 'inbound_text', 'manual', 'campaign')),
  campaign_id uuid REFERENCES public.wa_warm_campaigns(id) ON DELETE SET NULL,
  last_auto_reply_at timestamptz,
  opted_in_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, integration_id, phone)
);

CREATE INDEX IF NOT EXISTS idx_wa_warm_opt_ins_integration
  ON public.wa_warm_opt_ins(integration_id, phone);

ALTER TABLE public.wa_warm_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_warm_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_warm_opt_ins ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.wa_warm_campaigns FROM anon, authenticated;
REVOKE ALL ON public.wa_warm_recipients FROM anon, authenticated;
REVOKE ALL ON public.wa_warm_opt_ins FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.wa_warm_campaigns TO authenticated;
GRANT SELECT ON public.wa_warm_recipients TO authenticated;
GRANT SELECT ON public.wa_warm_opt_ins TO authenticated;
GRANT ALL ON public.wa_warm_campaigns TO service_role;
GRANT ALL ON public.wa_warm_recipients TO service_role;
GRANT ALL ON public.wa_warm_opt_ins TO service_role;

CREATE POLICY wa_warm_campaigns_select ON public.wa_warm_campaigns
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_effective_tenant_id() OR public.is_super_admin(auth.uid()));

CREATE POLICY wa_warm_campaigns_insert ON public.wa_warm_campaigns
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_effective_tenant_id() OR public.is_super_admin(auth.uid()));

CREATE POLICY wa_warm_campaigns_update ON public.wa_warm_campaigns
  FOR UPDATE TO authenticated
  USING (tenant_id = public.get_effective_tenant_id() OR public.is_super_admin(auth.uid()))
  WITH CHECK (tenant_id = public.get_effective_tenant_id() OR public.is_super_admin(auth.uid()));

CREATE POLICY wa_warm_recipients_select ON public.wa_warm_recipients
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_effective_tenant_id() OR public.is_super_admin(auth.uid()));

CREATE POLICY wa_warm_opt_ins_select ON public.wa_warm_opt_ins
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_effective_tenant_id() OR public.is_super_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.touch_wa_warm_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_wa_warm_campaigns_updated ON public.wa_warm_campaigns;
CREATE TRIGGER trg_wa_warm_campaigns_updated
  BEFORE UPDATE ON public.wa_warm_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.touch_wa_warm_updated_at();

DROP TRIGGER IF EXISTS trg_wa_warm_recipients_updated ON public.wa_warm_recipients;
CREATE TRIGGER trg_wa_warm_recipients_updated
  BEFORE UPDATE ON public.wa_warm_recipients
  FOR EACH ROW EXECUTE FUNCTION public.touch_wa_warm_updated_at();

DROP TRIGGER IF EXISTS trg_wa_warm_opt_ins_updated ON public.wa_warm_opt_ins;
CREATE TRIGGER trg_wa_warm_opt_ins_updated
  BEFORE UPDATE ON public.wa_warm_opt_ins
  FOR EACH ROW EXECUTE FUNCTION public.touch_wa_warm_updated_at();
