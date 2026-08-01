-- Deduplicate notification-only lead events without creating CRM lead rows.
CREATE TABLE IF NOT EXISTS public.lead_notification_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  source text NOT NULL,
  external_id text NOT NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  form_id text,
  received_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, source, external_id)
);

ALTER TABLE public.lead_notification_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_lead_notification_events_received
  ON public.lead_notification_events (tenant_id, received_at DESC);
