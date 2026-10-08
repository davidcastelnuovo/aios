-- Update existing green_api integrations to populate instance_id column
UPDATE tenant_integrations
SET instance_id = (settings->>'instance_id')::TEXT
WHERE integration_type = 'green_api'
  AND instance_id IS NULL
  AND settings->>'instance_id' IS NOT NULL;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_tenant_integrations_instance_id 
ON tenant_integrations(instance_id) 
WHERE integration_type = 'green_api' AND is_active = true;