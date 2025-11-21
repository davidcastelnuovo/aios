
-- Drop the old policy that doesn't check integration permissions
DROP POLICY IF EXISTS "Users can view their connection messages" ON chat_messages;

-- Create new policy that checks integration permissions for Green API
CREATE POLICY "Users can view their connection messages with permission"
ON chat_messages
FOR SELECT
TO public
USING (
  is_super_admin(auth.uid()) 
  OR sent_by_user_id = auth.uid()
  OR (
    connection_user_id = auth.uid() 
    AND (
      -- For Green API, check if user has permission to the integration
      provider = 'green_api' AND EXISTS (
        SELECT 1
        FROM tenant_integrations ti
        WHERE ti.integration_type = 'green_api'
          AND ti.user_id = connection_user_id
          AND ti.tenant_id = chat_messages.tenant_id
          AND user_has_integration_permission(auth.uid(), ti.id)
      )
      OR
      -- For ManyChat, allow if user has permission (tenant-level integration)
      provider = 'manychat' AND EXISTS (
        SELECT 1
        FROM tenant_integrations ti
        WHERE ti.integration_type = 'manychat'
          AND ti.tenant_id = chat_messages.tenant_id
          AND user_has_integration_permission(auth.uid(), ti.id)
      )
    )
  )
);

-- Also update the insert policy to check permissions
DROP POLICY IF EXISTS "Users can insert messages through their connection" ON chat_messages;

CREATE POLICY "Users can insert messages through their connection with permission"
ON chat_messages
FOR INSERT
TO public
WITH CHECK (
  is_super_admin(auth.uid())
  OR (
    sent_by_user_id = auth.uid() 
    AND connection_user_id = auth.uid()
    AND (
      -- For Green API, check if user has permission to the integration
      provider = 'green_api' AND EXISTS (
        SELECT 1
        FROM tenant_integrations ti
        WHERE ti.integration_type = 'green_api'
          AND ti.user_id = connection_user_id
          AND ti.tenant_id = tenant_id
          AND user_has_integration_permission(auth.uid(), ti.id)
      )
      OR
      -- For ManyChat, allow if user has permission (tenant-level integration)
      provider = 'manychat' AND EXISTS (
        SELECT 1
        FROM tenant_integrations ti
        WHERE ti.integration_type = 'manychat'
          AND ti.tenant_id = tenant_id
          AND user_has_integration_permission(auth.uid(), ti.id)
      )
    )
  )
);

-- Update the update policy as well
DROP POLICY IF EXISTS "Users can update their connection messages" ON chat_messages;

CREATE POLICY "Users can update their connection messages with permission"
ON chat_messages
FOR UPDATE
TO public
USING (
  is_super_admin(auth.uid())
  OR sent_by_user_id = auth.uid()
  OR (
    connection_user_id = auth.uid()
    AND (
      -- For Green API, check if user has permission to the integration
      provider = 'green_api' AND EXISTS (
        SELECT 1
        FROM tenant_integrations ti
        WHERE ti.integration_type = 'green_api'
          AND ti.user_id = connection_user_id
          AND ti.tenant_id = chat_messages.tenant_id
          AND user_has_integration_permission(auth.uid(), ti.id)
      )
      OR
      -- For ManyChat, allow if user has permission (tenant-level integration)
      provider = 'manychat' AND EXISTS (
        SELECT 1
        FROM tenant_integrations ti
        WHERE ti.integration_type = 'manychat'
          AND ti.tenant_id = chat_messages.tenant_id
          AND user_has_integration_permission(auth.uid(), ti.id)
      )
    )
  )
);

-- Update delete policy
DROP POLICY IF EXISTS "Users can delete their connection messages" ON chat_messages;

CREATE POLICY "Users can delete their connection messages with permission"
ON chat_messages
FOR DELETE
TO public
USING (
  is_super_admin(auth.uid())
  OR (
    connection_user_id = auth.uid()
    AND (
      -- For Green API, check if user has permission to the integration
      provider = 'green_api' AND EXISTS (
        SELECT 1
        FROM tenant_integrations ti
        WHERE ti.integration_type = 'green_api'
          AND ti.user_id = connection_user_id
          AND ti.tenant_id = chat_messages.tenant_id
          AND user_has_integration_permission(auth.uid(), ti.id)
      )
      OR
      -- For ManyChat, allow if user has permission (tenant-level integration)
      provider = 'manychat' AND EXISTS (
        SELECT 1
        FROM tenant_integrations ti
        WHERE ti.integration_type = 'manychat'
          AND ti.tenant_id = chat_messages.tenant_id
          AND user_has_integration_permission(auth.uid(), ti.id)
      )
    )
  )
);
