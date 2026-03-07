
-- Create supplier_invoices table
CREATE TABLE public.supplier_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  invoice_name TEXT NOT NULL DEFAULT '',
  invoice_amount NUMERIC NOT NULL DEFAULT 0,
  invoice_date DATE,
  invoice_month TEXT NOT NULL DEFAULT '',
  file_url TEXT,
  file_name TEXT,
  ai_extracted BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.supplier_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view invoices in their tenant"
  ON public.supplier_invoices FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can insert invoices in their tenant"
  ON public.supplier_invoices FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can update invoices in their tenant"
  ON public.supplier_invoices FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can delete invoices in their tenant"
  ON public.supplier_invoices FOR DELETE TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

-- Create storage bucket for supplier invoices
INSERT INTO storage.buckets (id, name, public) VALUES ('supplier-invoices', 'supplier-invoices', true);

-- Storage RLS policies
CREATE POLICY "Authenticated users can upload supplier invoices"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'supplier-invoices');

CREATE POLICY "Anyone can view supplier invoices"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'supplier-invoices');

CREATE POLICY "Authenticated users can delete supplier invoices"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'supplier-invoices');
