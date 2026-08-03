-- Applied via .github/workflows/apply-sql-migration.yml (Management API).
-- Source: supabase/migrations/20260803160000_clients_seo_keyword_relevance.sql

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS seo_keyword_relevance jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.clients.seo_keyword_relevance IS
  'Manual SEO keyword relevance overrides: { force_relevant: string[], force_irrelevant: string[] }. Used by in-app tables and public share links.';
