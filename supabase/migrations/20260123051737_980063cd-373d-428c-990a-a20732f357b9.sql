-- Create crm_dashboards table
CREATE TABLE public.crm_dashboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  agency_id UUID REFERENCES public.agencies(id) ON DELETE SET NULL,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.crm_dashboards ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view dashboards in their tenant"
ON public.crm_dashboards
FOR SELECT
USING (
  tenant_id = public.get_effective_tenant_id()
);

CREATE POLICY "Users can create dashboards in their tenant"
ON public.crm_dashboards
FOR INSERT
WITH CHECK (
  tenant_id = public.get_effective_tenant_id()
);

CREATE POLICY "Users can update dashboards in their tenant"
ON public.crm_dashboards
FOR UPDATE
USING (
  tenant_id = public.get_effective_tenant_id()
);

CREATE POLICY "Users can delete dashboards in their tenant"
ON public.crm_dashboards
FOR DELETE
USING (
  tenant_id = public.get_effective_tenant_id()
);

-- Create index for performance
CREATE INDEX idx_crm_dashboards_tenant_id ON public.crm_dashboards(tenant_id);
CREATE INDEX idx_crm_dashboards_client_id ON public.crm_dashboards(client_id);

-- Add trigger for updated_at
CREATE TRIGGER update_crm_dashboards_updated_at
BEFORE UPDATE ON public.crm_dashboards
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();