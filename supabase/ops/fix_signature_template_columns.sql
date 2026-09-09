-- Idempotent: ensure signature template columns exist (Staging + Production gap).
-- Root cause of "can't save template": insert stripped is_template and saved a draft.

ALTER TABLE public.signature_documents
  ADD COLUMN IF NOT EXISTS is_template boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS template_name text;

CREATE INDEX IF NOT EXISTS idx_signature_documents_templates
  ON public.signature_documents(tenant_id, is_template)
  WHERE is_template = true;

DO $$
BEGIN
  ALTER TYPE public.automation_action ADD VALUE IF NOT EXISTS 'send_signature';
EXCEPTION
  WHEN undefined_object THEN
    NULL; -- type may not exist on some envs; ignore
END $$;
