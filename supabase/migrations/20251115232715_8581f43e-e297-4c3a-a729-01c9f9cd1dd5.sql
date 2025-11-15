-- Create ENUM for chat provider
CREATE TYPE chat_provider AS ENUM ('manychat', 'green_api', 'internal');

-- Add provider column to chat_messages (NOT NULL with default)
ALTER TABLE chat_messages 
ADD COLUMN provider chat_provider NOT NULL DEFAULT 'internal';

-- Make channel NOT NULL with default
ALTER TABLE chat_messages 
ALTER COLUMN channel SET NOT NULL,
ALTER COLUMN channel SET DEFAULT 'whatsapp';

-- Add active_chat_provider to clients
ALTER TABLE clients 
ADD COLUMN active_chat_provider chat_provider;

-- Add active_chat_provider to leads
ALTER TABLE leads 
ADD COLUMN active_chat_provider chat_provider;

-- Create index for better performance
CREATE INDEX idx_chat_messages_provider ON chat_messages(tenant_id, provider, created_at DESC);

-- Migrate existing data: Update chat_messages based on raw_provider_data
UPDATE chat_messages 
SET provider = CASE
  WHEN raw_provider_data IS NOT NULL 
    AND (
      raw_provider_data::text LIKE '%manychat%' 
      OR raw_provider_data::text LIKE '%subscriber%'
    ) THEN 'manychat'::chat_provider
  WHEN channel = 'whatsapp' THEN 'green_api'::chat_provider
  ELSE 'internal'::chat_provider
END
WHERE provider = 'internal';

-- Update clients with active provider based on tenant_integrations
UPDATE clients 
SET active_chat_provider = (
  SELECT 
    CASE 
      WHEN integration_type = 'manychat' THEN 'manychat'::chat_provider
      WHEN integration_type = 'green_api' THEN 'green_api'::chat_provider
      ELSE NULL
    END
  FROM tenant_integrations 
  WHERE is_active = true 
  AND tenant_id = clients.tenant_id
  AND integration_type IN ('manychat', 'green_api')
  ORDER BY updated_at DESC
  LIMIT 1
)
WHERE active_chat_provider IS NULL;

-- Update leads with active provider based on tenant_integrations
UPDATE leads 
SET active_chat_provider = (
  SELECT 
    CASE 
      WHEN integration_type = 'manychat' THEN 'manychat'::chat_provider
      WHEN integration_type = 'green_api' THEN 'green_api'::chat_provider
      ELSE NULL
    END
  FROM tenant_integrations 
  WHERE is_active = true 
  AND tenant_id = leads.tenant_id
  AND integration_type IN ('manychat', 'green_api')
  ORDER BY updated_at DESC
  LIMIT 1
)
WHERE active_chat_provider IS NULL;