-- Link signature documents to leads/clients; track CRM save

ALTER TABLE public.signature_documents
  ADD COLUMN IF NOT EXISTS lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS saved_to_entity_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_signature_documents_lead
  ON public.signature_documents(tenant_id, lead_id)
  WHERE lead_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_signature_documents_client
  ON public.signature_documents(tenant_id, client_id)
  WHERE client_id IS NOT NULL;
