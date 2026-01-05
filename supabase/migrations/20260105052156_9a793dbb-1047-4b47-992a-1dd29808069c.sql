-- Create table for tracking breaks within a time entry
CREATE TABLE public.time_entry_breaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  time_entry_id UUID NOT NULL REFERENCES public.time_entries(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.time_entry_breaks ENABLE ROW LEVEL SECURITY;

-- RLS policies - users can manage breaks for their tenant
CREATE POLICY "Users can view breaks in their tenant"
  ON public.time_entry_breaks FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert breaks in their tenant"
  ON public.time_entry_breaks FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

CREATE POLICY "Users can update breaks in their tenant"
  ON public.time_entry_breaks FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete breaks in their tenant"
  ON public.time_entry_breaks FOR DELETE
  USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

-- Add index for faster lookups
CREATE INDEX idx_time_entry_breaks_time_entry_id ON public.time_entry_breaks(time_entry_id);
CREATE INDEX idx_time_entry_breaks_tenant_id ON public.time_entry_breaks(tenant_id);

-- Trigger for updated_at
CREATE TRIGGER update_time_entry_breaks_updated_at
  BEFORE UPDATE ON public.time_entry_breaks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();