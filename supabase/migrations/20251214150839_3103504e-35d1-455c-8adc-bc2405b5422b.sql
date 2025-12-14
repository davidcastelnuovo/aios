
-- Add RLS policy to allow users to view integrations they have permission to use
CREATE POLICY "Users can view integrations they have permission to use"
ON public.tenant_integrations
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM integration_user_permissions iup
    WHERE iup.integration_id = tenant_integrations.id
    AND iup.user_id = auth.uid()
  )
);
