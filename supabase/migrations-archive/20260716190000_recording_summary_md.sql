-- Rich in-app meeting summaries: persist the Markdown alongside the DOCX so
-- the UI can render it beautifully (react-markdown) instead of download-only.
ALTER TABLE public.zoom_recordings ADD COLUMN IF NOT EXISTS summary_md text;
ALTER TABLE public.zoom_recordings ADD COLUMN IF NOT EXISTS summary_generated_at timestamptz;
