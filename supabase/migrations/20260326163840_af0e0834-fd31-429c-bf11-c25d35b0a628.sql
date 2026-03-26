
CREATE TABLE public.table_shares (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  table_id UUID NOT NULL REFERENCES public.crm_tables(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  share_token TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex') UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  allowed_emails TEXT[] DEFAULT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.table_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their tenant table shares"
  ON public.table_shares
  FOR ALL
  TO authenticated
  USING (tenant_id = get_effective_tenant_id() OR is_super_admin(auth.uid()))
  WITH CHECK (tenant_id = get_effective_tenant_id() OR is_super_admin(auth.uid()));
