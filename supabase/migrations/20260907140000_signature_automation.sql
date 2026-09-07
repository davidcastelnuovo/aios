-- Signature templates + automation action

ALTER TABLE public.signature_documents
  ADD COLUMN IF NOT EXISTS is_template boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS template_name text;

CREATE INDEX IF NOT EXISTS idx_signature_documents_templates
  ON public.signature_documents(tenant_id, is_template)
  WHERE is_template = true;

ALTER TYPE public.automation_action ADD VALUE IF NOT EXISTS 'send_signature';
