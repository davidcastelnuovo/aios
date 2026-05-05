
-- Invoice uploads table
CREATE TABLE public.invoice_uploads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  uploaded_by UUID,
  file_path TEXT NOT NULL,
  mime_type TEXT,
  vendor_name TEXT,
  invoice_number TEXT,
  invoice_date DATE,
  total_amount NUMERIC,
  currency TEXT DEFAULT 'ILS',
  vat_amount NUMERIC,
  description TEXT,
  raw_extraction JSONB,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  agency_id UUID REFERENCES public.agencies(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  finance_id UUID REFERENCES public.finance(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_invoice_uploads_tenant ON public.invoice_uploads(tenant_id);
CREATE INDEX idx_invoice_uploads_status ON public.invoice_uploads(tenant_id, status);

ALTER TABLE public.invoice_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant members view invoice_uploads"
ON public.invoice_uploads FOR SELECT
USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "tenant members insert invoice_uploads"
ON public.invoice_uploads FOR INSERT
WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "tenant members update invoice_uploads"
ON public.invoice_uploads FOR UPDATE
USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "tenant members delete invoice_uploads"
ON public.invoice_uploads FOR DELETE
USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

CREATE TRIGGER set_invoice_uploads_updated_at
BEFORE UPDATE ON public.invoice_uploads
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('invoices', 'invoices', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: path prefix = <tenant_id>/...
CREATE POLICY "tenant members view invoice files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'invoices'
  AND (
    (storage.foldername(name))[1] = get_user_tenant_id(auth.uid())::text
    OR is_super_admin(auth.uid())
  )
);

CREATE POLICY "tenant members upload invoice files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'invoices'
  AND (
    (storage.foldername(name))[1] = get_user_tenant_id(auth.uid())::text
    OR is_super_admin(auth.uid())
  )
);

CREATE POLICY "tenant members delete invoice files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'invoices'
  AND (
    (storage.foldername(name))[1] = get_user_tenant_id(auth.uid())::text
    OR is_super_admin(auth.uid())
  )
);
