-- Drop existing unique constraint on tenant_integrations
ALTER TABLE tenant_integrations 
DROP CONSTRAINT IF EXISTS tenant_integrations_tenant_id_integration_type_key;

-- Create unique index for organization-level integrations (like ManyChat)
-- Only one integration per tenant when user_id IS NULL
CREATE UNIQUE INDEX IF NOT EXISTS tenant_integrations_org_level_unique 
ON tenant_integrations (tenant_id, integration_type) 
WHERE user_id IS NULL;

-- Create unique index for user-level integrations (like Green API)
-- Each user can have one integration per type within their tenant
CREATE UNIQUE INDEX IF NOT EXISTS tenant_integrations_user_level_unique 
ON tenant_integrations (tenant_id, integration_type, user_id) 
WHERE user_id IS NOT NULL;