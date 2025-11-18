
-- Update existing chat_messages with connection_user_id based on active integrations

-- For Green API messages
UPDATE chat_messages cm
SET connection_user_id = ti.user_id
FROM tenant_integrations ti
WHERE cm.connection_user_id IS NULL
  AND cm.provider = 'green_api'
  AND ti.tenant_id = cm.tenant_id
  AND ti.integration_type = 'green_api'
  AND ti.is_active = true;

-- For ManyChat messages  
UPDATE chat_messages cm
SET connection_user_id = ti.user_id
FROM tenant_integrations ti
WHERE cm.connection_user_id IS NULL
  AND cm.provider = 'manychat'
  AND ti.tenant_id = cm.tenant_id
  AND ti.integration_type = 'manychat'
  AND ti.is_active = true;

-- For any remaining messages without connection_user_id, use the tenant's first active integration user
UPDATE chat_messages cm
SET connection_user_id = (
  SELECT user_id 
  FROM tenant_integrations 
  WHERE tenant_id = cm.tenant_id 
    AND is_active = true 
  LIMIT 1
)
WHERE cm.connection_user_id IS NULL;
