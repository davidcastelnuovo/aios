-- Reconcile ai_agents with the schema the app already expects (drift surfaced
-- after the data restore). The frontend ProfileTab writes these and the
-- run-ai-agent edge function reads them; without them, full profile save and
-- the V1/V2 prompt toggle silently fail. All additive + idempotent.
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS language text DEFAULT 'he';
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS response_length text;
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS writing_style text;
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;
