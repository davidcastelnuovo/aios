-- Structured monthly SEO work log (on-site edits, articles, links)
-- stored alongside the existing status/notes row in seo_monthly_updates.

ALTER TABLE public.seo_monthly_updates
  ADD COLUMN IF NOT EXISTS work jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.seo_monthly_updates.work IS
  'Monthly SEO work log: { summary, onsite[], articles[], links[] }. Used by the SEO report "עבודה חודשית" tab.';
