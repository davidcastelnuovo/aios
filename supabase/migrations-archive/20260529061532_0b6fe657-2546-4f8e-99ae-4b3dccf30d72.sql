CREATE TABLE IF NOT EXISTS public.processed_webhook_messages (
  provider TEXT NOT NULL,
  tenant_id UUID NOT NULL,
  external_message_id TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, tenant_id, external_message_id)
);

GRANT ALL ON public.processed_webhook_messages TO service_role;
ALTER TABLE public.processed_webhook_messages ENABLE ROW LEVEL SECURITY;

-- Auto-purge old rows (keep 7 days) — handled by a periodic delete; no policies needed (service_role only).
CREATE INDEX IF NOT EXISTS idx_processed_webhook_messages_processed_at
  ON public.processed_webhook_messages (processed_at);
