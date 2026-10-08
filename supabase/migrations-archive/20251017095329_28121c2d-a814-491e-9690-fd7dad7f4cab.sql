-- Create client_suppliers table to link clients with suppliers and their payments
CREATE TABLE IF NOT EXISTS public.client_suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  supplier_payment NUMERIC DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(client_id, supplier_id)
);

-- Enable RLS
ALTER TABLE public.client_suppliers ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view client_suppliers"
ON public.client_suppliers
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert client_suppliers"
ON public.client_suppliers
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update client_suppliers"
ON public.client_suppliers
FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete client_suppliers"
ON public.client_suppliers
FOR DELETE
TO authenticated
USING (true);