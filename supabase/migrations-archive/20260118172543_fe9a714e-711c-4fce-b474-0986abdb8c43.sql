-- Create expense_payments table for tracking payments to suppliers/campaigners
CREATE TABLE public.expense_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  expense_type TEXT NOT NULL CHECK (expense_type IN ('supplier', 'campaigner')),
  expense_id UUID NOT NULL,
  expense_name TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  payment_month TEXT NOT NULL, -- Format: YYYY-MM
  paid_at TIMESTAMPTZ DEFAULT NOW(),
  paid_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create income_payments table for tracking payments received from clients
CREATE TABLE public.income_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  client_name TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  payment_month TEXT NOT NULL, -- Format: YYYY-MM
  received_at TIMESTAMPTZ DEFAULT NOW(),
  received_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.expense_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.income_payments ENABLE ROW LEVEL SECURITY;

-- RLS policies for expense_payments
CREATE POLICY "Users can view expense_payments in their tenant"
ON public.expense_payments FOR SELECT
USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE POLICY "Users can create expense_payments in their tenant"
ON public.expense_payments FOR INSERT
WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can delete expense_payments in their tenant"
ON public.expense_payments FOR DELETE
USING (tenant_id = public.get_user_tenant_id(auth.uid()));

-- RLS policies for income_payments
CREATE POLICY "Users can view income_payments in their tenant"
ON public.income_payments FOR SELECT
USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE POLICY "Users can create income_payments in their tenant"
ON public.income_payments FOR INSERT
WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can delete income_payments in their tenant"
ON public.income_payments FOR DELETE
USING (tenant_id = public.get_user_tenant_id(auth.uid()));

-- Create indexes for better performance
CREATE INDEX idx_expense_payments_tenant_month ON public.expense_payments(tenant_id, payment_month);
CREATE INDEX idx_expense_payments_expense ON public.expense_payments(expense_type, expense_id);
CREATE INDEX idx_income_payments_tenant_month ON public.income_payments(tenant_id, payment_month);
CREATE INDEX idx_income_payments_client ON public.income_payments(client_id);