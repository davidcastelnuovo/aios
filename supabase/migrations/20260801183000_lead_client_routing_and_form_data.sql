-- Persist the owning agency client and structured form answers on every lead.
-- This lets a single automation route each lead to a different client and
-- render all screening answers through {{form_qa_summary}}.
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS facebook_form_id text,
  ADD COLUMN IF NOT EXISTS facebook_leadgen_id text,
  ADD COLUMN IF NOT EXISTS form_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS form_qa_summary text;

CREATE INDEX IF NOT EXISTS idx_leads_client_id
  ON public.leads (client_id)
  WHERE client_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leads_facebook_form_id
  ON public.leads (tenant_id, facebook_form_id)
  WHERE facebook_form_id IS NOT NULL;
