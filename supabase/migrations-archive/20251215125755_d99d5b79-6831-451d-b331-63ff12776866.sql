-- Add integrations column to crm_tables for multi-platform support
ALTER TABLE public.crm_tables 
ADD COLUMN IF NOT EXISTS integrations jsonb DEFAULT '[]'::jsonb;

-- Add last_sync_at column if not exists
ALTER TABLE public.crm_tables 
ADD COLUMN IF NOT EXISTS last_sync_at timestamp with time zone;

-- Comment for documentation
COMMENT ON COLUMN public.crm_tables.integrations IS 'Array of platform integrations: [{type: "facebook_insights", settings: {...}}, {type: "google_ads", settings: {...}}]';