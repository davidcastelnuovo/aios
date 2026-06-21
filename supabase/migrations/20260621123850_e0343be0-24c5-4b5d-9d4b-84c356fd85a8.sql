CREATE TYPE public.marketing_stage_type AS ENUM
  ('strategy','copy','creative','target_paid','target_seo','target_organic','measurement');
CREATE TYPE public.marketing_approval_mode AS ENUM ('manual','auto','hybrid');
CREATE TYPE public.marketing_item_status AS ENUM
  ('draft','in_progress','waiting_approval','approved','published','failed','archived');

CREATE TABLE public.marketing_pipelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'מחלקת שיווק',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(client_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_pipelines TO authenticated;
GRANT ALL ON public.marketing_pipelines TO service_role;
ALTER TABLE public.marketing_pipelines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_all_pipelines" ON public.marketing_pipelines FOR ALL TO authenticated
  USING (tenant_id = public.get_effective_tenant_id() OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (tenant_id = public.get_effective_tenant_id() OR public.has_role(auth.uid(), 'super_admin'));

CREATE TABLE public.marketing_pipeline_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id uuid NOT NULL REFERENCES public.marketing_pipelines(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL,
  stage_type public.marketing_stage_type NOT NULL,
  name text NOT NULL,
  agent_id uuid REFERENCES public.ai_agents(id) ON DELETE SET NULL,
  approval_mode public.marketing_approval_mode NOT NULL DEFAULT 'manual',
  position_x int NOT NULL DEFAULT 0,
  position_y int NOT NULL DEFAULT 0,
  parent_stage_id uuid REFERENCES public.marketing_pipeline_stages(id) ON DELETE SET NULL,
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_pipeline_stages TO authenticated;
GRANT ALL ON public.marketing_pipeline_stages TO service_role;
ALTER TABLE public.marketing_pipeline_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_all_stages" ON public.marketing_pipeline_stages FOR ALL TO authenticated
  USING (tenant_id = public.get_effective_tenant_id() OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (tenant_id = public.get_effective_tenant_id() OR public.has_role(auth.uid(), 'super_admin'));

CREATE TABLE public.marketing_work_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id uuid NOT NULL REFERENCES public.marketing_pipelines(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL,
  client_id uuid NOT NULL,
  current_stage_id uuid REFERENCES public.marketing_pipeline_stages(id) ON DELETE SET NULL,
  target_channel text,
  title text,
  status public.marketing_item_status NOT NULL DEFAULT 'draft',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  links jsonb NOT NULL DEFAULT '{}'::jsonb,
  scheduled_date date,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_work_items TO authenticated;
GRANT ALL ON public.marketing_work_items TO service_role;
ALTER TABLE public.marketing_work_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_all_items" ON public.marketing_work_items FOR ALL TO authenticated
  USING (tenant_id = public.get_effective_tenant_id() OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (tenant_id = public.get_effective_tenant_id() OR public.has_role(auth.uid(), 'super_admin'));

CREATE TABLE public.marketing_item_transitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.marketing_work_items(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL,
  from_stage_id uuid,
  to_stage_id uuid,
  triggered_by uuid,
  trigger_type text NOT NULL DEFAULT 'manual',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.marketing_item_transitions TO authenticated;
GRANT ALL ON public.marketing_item_transitions TO service_role;
ALTER TABLE public.marketing_item_transitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_select_transitions" ON public.marketing_item_transitions FOR SELECT TO authenticated
  USING (tenant_id = public.get_effective_tenant_id() OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "tenant_insert_transitions" ON public.marketing_item_transitions FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_effective_tenant_id() OR public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER trg_marketing_pipelines_updated BEFORE UPDATE ON public.marketing_pipelines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_marketing_pipeline_stages_updated BEFORE UPDATE ON public.marketing_pipeline_stages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_marketing_work_items_updated BEFORE UPDATE ON public.marketing_work_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_mkt_stages_pipeline ON public.marketing_pipeline_stages(pipeline_id);
CREATE INDEX idx_mkt_items_pipeline ON public.marketing_work_items(pipeline_id);
CREATE INDEX idx_mkt_items_stage ON public.marketing_work_items(current_stage_id);
CREATE INDEX idx_mkt_transitions_item ON public.marketing_item_transitions(item_id);