
-- Add policy to allow tenant users to view integrations in their tenant
-- This is needed because automations need to select from available integrations
CREATE POLICY "Users can view tenant integrations"
ON tenant_integrations
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM tenant_users tu
    WHERE tu.tenant_id = tenant_integrations.tenant_id
    AND tu.user_id = auth.uid()
  )
);
