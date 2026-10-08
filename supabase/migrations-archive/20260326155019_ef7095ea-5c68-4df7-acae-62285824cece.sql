CREATE TABLE public.client_credentials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  service_name TEXT NOT NULL,
  username TEXT,
  password TEXT,
  url TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.client_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view credentials in their tenant"
  ON public.client_credentials FOR SELECT
  TO authenticated
  USING (tenant_id = public.get_effective_tenant_id() OR public.is_super_admin(auth.uid()));

CREATE POLICY "Users can insert credentials in their tenant"
  ON public.client_credentials FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = public.get_effective_tenant_id());

CREATE POLICY "Users can update credentials in their tenant"
  ON public.client_credentials FOR UPDATE
  TO authenticated
  USING (tenant_id = public.get_effective_tenant_id());

CREATE POLICY "Users can delete credentials in their tenant"
  ON public.client_credentials FOR DELETE
  TO authenticated
  USING (tenant_id = public.get_effective_tenant_id());