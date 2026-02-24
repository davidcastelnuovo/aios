
-- Create table for one-time income items
CREATE TABLE public.one_time_incomes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  client_id UUID NOT NULL REFERENCES public.clients(id),
  product_name TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  payment_month TEXT NOT NULL,
  notes TEXT,
  is_paid BOOLEAN NOT NULL DEFAULT false,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.one_time_incomes ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view one_time_incomes in their tenant"
ON public.one_time_incomes FOR SELECT
USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Users can insert one_time_incomes in their tenant"
ON public.one_time_incomes FOR INSERT
WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Users can update one_time_incomes in their tenant"
ON public.one_time_incomes FOR UPDATE
USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Users can delete one_time_incomes in their tenant"
ON public.one_time_incomes FOR DELETE
USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

-- Index
CREATE INDEX idx_one_time_incomes_tenant_month ON public.one_time_incomes(tenant_id, payment_month);
