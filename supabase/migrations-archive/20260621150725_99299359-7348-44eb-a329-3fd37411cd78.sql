
CREATE TABLE public.marketing_stage_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  track text NOT NULL CHECK (track IN ('campaigns','seo_geo','social_organic')),
  stage_type text NOT NULL,
  name text NOT NULL,
  default_agent_id uuid,
  default_approval_mode text NOT NULL DEFAULT 'manual' CHECK (default_approval_mode IN ('manual','auto','hybrid')),
  default_instructions text,
  default_tools jsonb NOT NULL DEFAULT '[]'::jsonb,
  default_target jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, track, stage_type)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_stage_templates TO authenticated;
GRANT ALL ON public.marketing_stage_templates TO service_role;
ALTER TABLE public.marketing_stage_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant members manage templates" ON public.marketing_stage_templates
  FOR ALL TO authenticated
  USING (tenant_id = get_effective_tenant_id() OR is_super_admin(auth.uid()))
  WITH CHECK (tenant_id = get_effective_tenant_id() OR is_super_admin(auth.uid()));
CREATE TRIGGER trg_mst_updated BEFORE UPDATE ON public.marketing_stage_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.marketing_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  item_id uuid NOT NULL,
  stage_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','awaiting_approval','completed','failed','cancelled')),
  input jsonb NOT NULL DEFAULT '{}'::jsonb,
  output jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  model text,
  tokens_in integer NOT NULL DEFAULT 0,
  tokens_out integer NOT NULL DEFAULT 0,
  cost_usd numeric(12,6) NOT NULL DEFAULT 0,
  started_at timestamptz,
  finished_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_marketing_runs_item ON public.marketing_runs(item_id, created_at DESC);
CREATE INDEX idx_marketing_runs_tenant_created ON public.marketing_runs(tenant_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_runs TO authenticated;
GRANT ALL ON public.marketing_runs TO service_role;
ALTER TABLE public.marketing_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant members read runs" ON public.marketing_runs
  FOR SELECT TO authenticated
  USING (tenant_id = get_effective_tenant_id() OR is_super_admin(auth.uid()));
CREATE POLICY "tenant members write runs" ON public.marketing_runs
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_effective_tenant_id() OR is_super_admin(auth.uid()));
CREATE POLICY "tenant members update runs" ON public.marketing_runs
  FOR UPDATE TO authenticated
  USING (tenant_id = get_effective_tenant_id() OR is_super_admin(auth.uid()))
  WITH CHECK (tenant_id = get_effective_tenant_id() OR is_super_admin(auth.uid()));
CREATE TRIGGER trg_mruns_updated BEFORE UPDATE ON public.marketing_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.marketing_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  item_id uuid NOT NULL,
  run_id uuid,
  stage_id uuid,
  type text NOT NULL CHECK (type IN ('copy','image','video','brief','data')),
  url text,
  content text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_marketing_assets_item ON public.marketing_assets(item_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_assets TO authenticated;
GRANT ALL ON public.marketing_assets TO service_role;
ALTER TABLE public.marketing_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant members manage assets" ON public.marketing_assets
  FOR ALL TO authenticated
  USING (tenant_id = get_effective_tenant_id() OR is_super_admin(auth.uid()))
  WITH CHECK (tenant_id = get_effective_tenant_id() OR is_super_admin(auth.uid()));

CREATE TABLE public.marketing_triggers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  client_id uuid NOT NULL,
  pipeline_id uuid NOT NULL,
  name text NOT NULL,
  trigger_type text NOT NULL DEFAULT 'schedule' CHECK (trigger_type IN ('schedule','event','manual')),
  schedule_cron text,
  schedule_preset text CHECK (schedule_preset IN ('daily','weekly','monthly','hourly')),
  schedule_hour integer DEFAULT 9,
  schedule_dow integer,
  schedule_dom integer,
  event_type text,
  template_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  next_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_marketing_triggers_active ON public.marketing_triggers(is_active, next_run_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_triggers TO authenticated;
GRANT ALL ON public.marketing_triggers TO service_role;
ALTER TABLE public.marketing_triggers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant members manage triggers" ON public.marketing_triggers
  FOR ALL TO authenticated
  USING (tenant_id = get_effective_tenant_id() OR is_super_admin(auth.uid()))
  WITH CHECK (tenant_id = get_effective_tenant_id() OR is_super_admin(auth.uid()));
CREATE TRIGGER trg_mtrig_updated BEFORE UPDATE ON public.marketing_triggers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
