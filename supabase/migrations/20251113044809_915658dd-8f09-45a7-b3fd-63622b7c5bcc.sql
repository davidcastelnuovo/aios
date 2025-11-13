-- Add slug column to tenants table
ALTER TABLE public.tenants 
ADD COLUMN slug text;

-- Create unique index on slug
CREATE UNIQUE INDEX tenants_slug_unique ON public.tenants(slug);

-- Generate initial slugs from existing tenant names
-- Convert to lowercase, replace spaces with hyphens, remove special chars
UPDATE public.tenants 
SET slug = lower(regexp_replace(regexp_replace(name, '[^a-zA-Z0-9\s-]', '', 'g'), '\s+', '-', 'g'))
WHERE slug IS NULL;

-- Make slug NOT NULL after populating
ALTER TABLE public.tenants 
ALTER COLUMN slug SET NOT NULL;

-- Add comment
COMMENT ON COLUMN public.tenants.slug IS 'URL-friendly unique identifier for the tenant';