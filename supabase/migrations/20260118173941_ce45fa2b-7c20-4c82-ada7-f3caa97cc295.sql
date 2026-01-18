-- Create payment_links table for tracking Sumit payment links
CREATE TABLE public.payment_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  description TEXT,
  payment_url TEXT NOT NULL,
  sumit_payment_id TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'expired', 'cancelled')),
  send_email BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.payment_links ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view payment links from their tenant"
ON public.payment_links FOR SELECT
USING (tenant_id IN (
  SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
));

CREATE POLICY "Users can create payment links in their tenant"
ON public.payment_links FOR INSERT
WITH CHECK (tenant_id IN (
  SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
));

CREATE POLICY "Users can update payment links in their tenant"
ON public.payment_links FOR UPDATE
USING (tenant_id IN (
  SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
));

CREATE POLICY "Users can delete payment links in their tenant"
ON public.payment_links FOR DELETE
USING (tenant_id IN (
  SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
));

-- Index for faster queries
CREATE INDEX idx_payment_links_tenant_id ON public.payment_links(tenant_id);
CREATE INDEX idx_payment_links_client_id ON public.payment_links(client_id);
CREATE INDEX idx_payment_links_status ON public.payment_links(status);