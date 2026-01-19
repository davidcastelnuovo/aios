-- Add folder_links column to clients table
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS folder_links jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Migrate existing folder_link data to folder_links
UPDATE public.clients
SET folder_links = jsonb_build_array(
  jsonb_build_object('name', 'קישור', 'url', folder_link)
)
WHERE folder_link IS NOT NULL
  AND folder_link <> ''
  AND (folder_links IS NULL OR folder_links = '[]'::jsonb);