-- Add instance_id and api_token_last_4 to tenant_integrations for Green API isolation
ALTER TABLE public.tenant_integrations
ADD COLUMN IF NOT EXISTS instance_id TEXT,
ADD COLUMN IF NOT EXISTS api_token_last_4 TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_tenant_integrations_instance_id 
ON public.tenant_integrations(instance_id) 
WHERE integration_type = 'green_api';

-- Update existing Green API integrations with instance_id from settings
UPDATE public.tenant_integrations
SET instance_id = (settings->>'instanceId')::TEXT
WHERE integration_type = 'green_api' 
AND settings->>'instanceId' IS NOT NULL
AND instance_id IS NULL;