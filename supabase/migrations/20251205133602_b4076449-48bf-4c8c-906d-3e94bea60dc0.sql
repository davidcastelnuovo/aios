-- Add explicit INSERT policy for tenant_integrations to ensure users can create their own integrations
-- First check if there's an issue with the ALL policy

DROP POLICY IF EXISTS "Users can insert their own integrations" ON public.tenant_integrations;

CREATE POLICY "Users can insert their own integrations" 
ON public.tenant_integrations 
FOR INSERT
WITH CHECK (
  user_id = auth.uid() 
  AND (
    -- User must be part of the tenant they're creating integration for
    EXISTS (
      SELECT 1 FROM tenant_users tu 
      WHERE tu.user_id = auth.uid() 
      AND tu.tenant_id = tenant_integrations.tenant_id
    )
    OR is_super_admin(auth.uid())
  )
);