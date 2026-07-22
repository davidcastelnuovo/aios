-- Unified AI usage metering for the Command Center usage panel and the
-- credit-budget alerts. Written by _shared/ai.ts helpers and the health
-- probe (service role only); read by authenticated users.

CREATE TABLE IF NOT EXISTS public.ai_usage_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  source text NOT NULL,
  model text,
  tokens_in integer,
  tokens_out integer,
  cost_usd numeric(12, 6),
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_log_created ON public.ai_usage_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_tenant ON public.ai_usage_log (tenant_id, created_at DESC);

ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;

-- Single-org deployment: any signed-in user may read the org's usage numbers.
CREATE POLICY "ai_usage_log_read" ON public.ai_usage_log
  FOR SELECT TO authenticated USING (true);
-- Writes: service role only (no insert/update/delete policies).
