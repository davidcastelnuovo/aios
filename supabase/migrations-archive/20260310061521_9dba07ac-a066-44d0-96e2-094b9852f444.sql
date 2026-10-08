CREATE TABLE public.flow_processed_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  leadgen_id text NOT NULL,
  facebook_form_id text,
  processed_at timestamptz DEFAULT now(),
  UNIQUE(automation_id, leadgen_id)
);

ALTER TABLE flow_processed_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view flow processed leads in their tenant"
ON flow_processed_leads FOR SELECT TO authenticated
USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Service can manage flow processed leads"
ON flow_processed_leads FOR ALL TO service_role USING (true);

CREATE INDEX idx_flow_processed_leads_automation ON flow_processed_leads(automation_id, leadgen_id);