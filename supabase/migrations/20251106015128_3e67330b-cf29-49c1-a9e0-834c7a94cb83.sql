-- Create table for tenant-specific client financial data
CREATE TABLE IF NOT EXISTS public.client_tenant_financial_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  retainer NUMERIC,
  monthly_budget NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(client_id, tenant_id)
);

-- Enable RLS
ALTER TABLE public.client_tenant_financial_data ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view financial data in their tenant"
  ON public.client_tenant_financial_data
  FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Users can insert financial data in their tenant"
  ON public.client_tenant_financial_data
  FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Users can update financial data in their tenant"
  ON public.client_tenant_financial_data
  FOR UPDATE
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Users can delete financial data in their tenant"
  ON public.client_tenant_financial_data
  FOR DELETE
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_client_tenant_financial_data_updated_at
  BEFORE UPDATE ON public.client_tenant_financial_data
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_client_tenant_financial_data_client_tenant 
  ON public.client_tenant_financial_data(client_id, tenant_id);

COMMENT ON TABLE public.client_tenant_financial_data IS 'Stores tenant-specific financial data for clients, allowing each tenant to manage their own retainer and budget for shared clients';