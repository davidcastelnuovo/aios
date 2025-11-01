-- Create enum for automation trigger types
CREATE TYPE automation_trigger AS ENUM (
  'task_assigned',
  'task_status_changed',
  'lead_status_changed',
  'lead_created',
  'client_created',
  'client_status_changed',
  'onboarding_status_changed'
);

-- Create enum for automation action types
CREATE TYPE automation_action AS ENUM (
  'webhook',
  'email',
  'notification'
);

-- Create automations table
CREATE TABLE public.automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  trigger_type automation_trigger NOT NULL,
  conditions JSONB DEFAULT '{}'::jsonb,
  action_type automation_action NOT NULL,
  configuration JSONB NOT NULL,
  active BOOLEAN DEFAULT true,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create automation_logs table for execution history
CREATE TABLE public.automation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id UUID REFERENCES public.automations(id) ON DELETE CASCADE NOT NULL,
  triggered_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  success BOOLEAN NOT NULL,
  error_message TEXT,
  payload JSONB,
  response JSONB,
  execution_time_ms INTEGER
);

-- Enable RLS
ALTER TABLE public.automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for automations
CREATE POLICY "Users can view automations in their tenant"
  ON public.automations FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Owners can manage automations"
  ON public.automations FOR ALL
  USING (
    (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'owner'::app_role))
    OR is_super_admin(auth.uid())
  )
  WITH CHECK (
    (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'owner'::app_role))
    OR is_super_admin(auth.uid())
  );

-- RLS Policies for automation_logs
CREATE POLICY "Users can view automation logs in their tenant"
  ON public.automation_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.automations
      WHERE automations.id = automation_logs.automation_id
        AND (automations.tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()))
    )
  );

CREATE POLICY "System can insert automation logs"
  ON public.automation_logs FOR INSERT
  WITH CHECK (true);

-- Create index for performance
CREATE INDEX idx_automations_tenant_id ON public.automations(tenant_id);
CREATE INDEX idx_automations_trigger_type ON public.automations(trigger_type);
CREATE INDEX idx_automations_active ON public.automations(active);
CREATE INDEX idx_automation_logs_automation_id ON public.automation_logs(automation_id);
CREATE INDEX idx_automation_logs_triggered_at ON public.automation_logs(triggered_at DESC);

-- Trigger for updating updated_at
CREATE TRIGGER update_automations_updated_at
  BEFORE UPDATE ON public.automations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();