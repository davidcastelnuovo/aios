ALTER TABLE public.automations
  ADD COLUMN IF NOT EXISTS source_automation_id uuid NULL,
  ADD COLUMN IF NOT EXISTS source_tenant_id uuid NULL;

CREATE INDEX IF NOT EXISTS idx_automations_source_automation_id
  ON public.automations(source_automation_id);