
-- Add is_flow column to automations
ALTER TABLE public.automations ADD COLUMN IF NOT EXISTS is_flow boolean NOT NULL DEFAULT false;

-- Create automation_flow_steps table
CREATE TABLE public.automation_flow_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  step_type text NOT NULL DEFAULT 'action',
  action_type text,
  label text,
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  position_x integer NOT NULL DEFAULT 0,
  position_y integer NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  parent_step_id uuid REFERENCES public.automation_flow_steps(id) ON DELETE SET NULL,
  condition_branch text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.automation_flow_steps ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view flow steps in their tenant"
  ON public.automation_flow_steps FOR SELECT
  TO authenticated
  USING (tenant_id = get_effective_tenant_id() OR is_super_admin(auth.uid()));

CREATE POLICY "Users can insert flow steps in their tenant"
  ON public.automation_flow_steps FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = get_effective_tenant_id() OR is_super_admin(auth.uid()));

CREATE POLICY "Users can update flow steps in their tenant"
  ON public.automation_flow_steps FOR UPDATE
  TO authenticated
  USING (tenant_id = get_effective_tenant_id() OR is_super_admin(auth.uid()));

CREATE POLICY "Users can delete flow steps in their tenant"
  ON public.automation_flow_steps FOR DELETE
  TO authenticated
  USING (tenant_id = get_effective_tenant_id() OR is_super_admin(auth.uid()));

-- Index
CREATE INDEX idx_automation_flow_steps_automation_id ON public.automation_flow_steps(automation_id);
CREATE INDEX idx_automation_flow_steps_tenant_id ON public.automation_flow_steps(tenant_id);
