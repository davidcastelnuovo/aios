-- Staging drift: Production dropped marketing_assets.type CHECK; mirror rejects storyboard rows.
ALTER TABLE public.marketing_assets DROP CONSTRAINT IF EXISTS marketing_assets_type_check;
