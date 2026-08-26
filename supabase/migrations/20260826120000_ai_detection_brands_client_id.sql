-- Attach existing AI-visibility projects to a client so they live inside SEO/GEO.
-- Also hide the leftover standalone /ai-detection menu item (the UI now sits in marketing SEO).

ALTER TABLE public.ai_detection_brands
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ai_detection_brands_client
  ON public.ai_detection_brands(tenant_id, client_id);

UPDATE public.menu_items
SET
  is_visible = false,
  route = '/marketing/department/seo',
  original_label = 'ניטור נראות AI'
WHERE menu_key = 'ai-detection';
