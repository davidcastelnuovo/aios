-- Add integration columns to crm_tables for Facebook Insights integration
ALTER TABLE public.crm_tables 
ADD COLUMN IF NOT EXISTS integration_type TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS integration_settings JSONB DEFAULT '{}'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN public.crm_tables.integration_type IS 'Type of integration: null for regular table, facebook_insights for Facebook-linked tables';
COMMENT ON COLUMN public.crm_tables.integration_settings IS 'Integration settings JSON: page_id, ad_account_id, sync_frequency, last_sync_at, etc.';