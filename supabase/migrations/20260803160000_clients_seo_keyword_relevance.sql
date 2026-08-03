-- Persist SEO keyword relevance overrides (לא רלוונטי / רלוונטי) on the client
-- so share links and every browser see the same filtered Top 20.
-- Shape: { "force_relevant": string[], "force_irrelevant": string[] }

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS seo_keyword_relevance jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.clients.seo_keyword_relevance IS
  'Manual SEO keyword relevance overrides: { force_relevant: string[], force_irrelevant: string[] }. Used by in-app tables and public share links.';
