-- Create report_alerts table for managing alert rules on dynamic tables
CREATE TABLE public.report_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  table_id UUID NOT NULL REFERENCES public.crm_tables(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  metric TEXT NOT NULL, -- 'cost_per_lead', 'spend', 'ctr', 'cpm', 'leads', 'impressions', 'clicks'
  comparison_type TEXT NOT NULL, -- 'week_over_week', 'month_over_month', 'vs_target'
  operator TEXT NOT NULL, -- 'increase', 'decrease', 'above', 'below'
  threshold NUMERIC NOT NULL, -- percentage or absolute value
  is_percentage BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.report_alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view alerts in their tenant"
ON public.report_alerts
FOR SELECT
USING (tenant_id IN (
  SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
));

CREATE POLICY "Users can create alerts in their tenant"
ON public.report_alerts
FOR INSERT
WITH CHECK (tenant_id IN (
  SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
));

CREATE POLICY "Users can update alerts in their tenant"
ON public.report_alerts
FOR UPDATE
USING (tenant_id IN (
  SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
));

CREATE POLICY "Users can delete alerts in their tenant"
ON public.report_alerts
FOR DELETE
USING (tenant_id IN (
  SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
));

-- Create index for performance
CREATE INDEX idx_report_alerts_tenant_table ON public.report_alerts(tenant_id, table_id);

-- Add updated_at trigger
CREATE TRIGGER update_report_alerts_updated_at
BEFORE UPDATE ON public.report_alerts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();