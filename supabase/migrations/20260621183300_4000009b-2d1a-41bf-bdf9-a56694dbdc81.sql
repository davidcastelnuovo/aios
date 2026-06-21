
CREATE TABLE public.marketing_media_library (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  client_id UUID,
  lead_id UUID,
  bucket_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size BIGINT,
  width INTEGER,
  height INTEGER,
  duration_seconds NUMERIC,
  source TEXT NOT NULL DEFAULT 'whatsapp',
  source_message_id UUID,
  caption TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  ad_ready BOOLEAN NOT NULL DEFAULT true,
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mml_tenant ON public.marketing_media_library(tenant_id);
CREATE INDEX idx_mml_client ON public.marketing_media_library(client_id) WHERE client_id IS NOT NULL;
CREATE INDEX idx_mml_lead ON public.marketing_media_library(lead_id) WHERE lead_id IS NOT NULL;
CREATE INDEX idx_mml_tags ON public.marketing_media_library USING gin(tags);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_media_library TO authenticated;
GRANT ALL ON public.marketing_media_library TO service_role;

ALTER TABLE public.marketing_media_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mml_tenant_select" ON public.marketing_media_library
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_effective_tenant_id() OR public.is_super_admin(auth.uid()));

CREATE POLICY "mml_tenant_insert" ON public.marketing_media_library
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_effective_tenant_id() OR public.is_super_admin(auth.uid()));

CREATE POLICY "mml_tenant_update" ON public.marketing_media_library
  FOR UPDATE TO authenticated
  USING (tenant_id = public.get_effective_tenant_id() OR public.is_super_admin(auth.uid()))
  WITH CHECK (tenant_id = public.get_effective_tenant_id() OR public.is_super_admin(auth.uid()));

CREATE POLICY "mml_tenant_delete" ON public.marketing_media_library
  FOR DELETE TO authenticated
  USING (tenant_id = public.get_effective_tenant_id() OR public.is_super_admin(auth.uid()));

CREATE TRIGGER trg_mml_updated_at
  BEFORE UPDATE ON public.marketing_media_library
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


CREATE TABLE public.campaign_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  client_id UUID,
  entity_id TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('fb_campaign','fb_adset','fb_ad','google_campaign','google_adgroup','google_ad')),
  action TEXT NOT NULL CHECK (action IN ('pause','resume')),
  cron_expression TEXT,
  run_at TIMESTAMPTZ,
  timezone TEXT NOT NULL DEFAULT 'Asia/Jerusalem',
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMPTZ,
  last_run_status TEXT,
  last_run_error TEXT,
  next_run_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  approved_by UUID,
  created_by UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT campaign_schedules_when_chk CHECK (cron_expression IS NOT NULL OR run_at IS NOT NULL)
);

CREATE INDEX idx_cs_tenant ON public.campaign_schedules(tenant_id);
CREATE INDEX idx_cs_next_run ON public.campaign_schedules(next_run_at) WHERE enabled = true;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_schedules TO authenticated;
GRANT ALL ON public.campaign_schedules TO service_role;

ALTER TABLE public.campaign_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cs_tenant_select" ON public.campaign_schedules
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_effective_tenant_id() OR public.is_super_admin(auth.uid()));

CREATE POLICY "cs_tenant_insert" ON public.campaign_schedules
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_effective_tenant_id() OR public.is_super_admin(auth.uid()));

CREATE POLICY "cs_tenant_update" ON public.campaign_schedules
  FOR UPDATE TO authenticated
  USING (tenant_id = public.get_effective_tenant_id() OR public.is_super_admin(auth.uid()))
  WITH CHECK (tenant_id = public.get_effective_tenant_id() OR public.is_super_admin(auth.uid()));

CREATE POLICY "cs_tenant_delete" ON public.campaign_schedules
  FOR DELETE TO authenticated
  USING (tenant_id = public.get_effective_tenant_id() OR public.is_super_admin(auth.uid()));

CREATE TRIGGER trg_cs_updated_at
  BEFORE UPDATE ON public.campaign_schedules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
