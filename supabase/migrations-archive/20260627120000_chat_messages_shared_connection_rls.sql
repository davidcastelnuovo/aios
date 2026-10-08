-- Fix chat_messages RLS to support shared WhatsApp connections
-- A user can view messages if:
--   1. They are super admin
--   2. The connection_user_id is their own user_id (private connection)
--   3. The connection belongs to an integration with connection_visibility = 'org' (whole org can see)
--   4. The connection belongs to an integration where the user has explicit permission in integration_user_permissions
--   5. They are an owner in the tenant (owners see all)

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Users view their connection messages in current tenant" ON public.chat_messages;
DROP POLICY IF EXISTS "Users view own connection messages" ON public.chat_messages;

-- Create new SELECT policy with shared connection support
CREATE POLICY "Users view chat messages with connection access"
ON public.chat_messages FOR SELECT TO authenticated
USING (
  -- Super admin bypass
  is_super_admin(auth.uid())
  OR
  -- Owner sees all messages in their tenant
  (
    tenant_id = get_user_tenant_id(auth.uid())
    AND has_role(auth.uid(), 'owner'::app_role)
  )
  OR
  -- User owns the connection directly (private or any visibility)
  (
    connection_user_id = auth.uid()
    AND tenant_id = get_user_tenant_id(auth.uid())
    AND (is_blocked IS NULL OR is_blocked = false)
  )
  OR
  -- Connection belongs to an org-visible integration (connection_visibility = 'org')
  (
    tenant_id = get_user_tenant_id(auth.uid())
    AND (is_blocked IS NULL OR is_blocked = false)
    AND EXISTS (
      SELECT 1
      FROM public.tenant_integrations ti
      WHERE ti.user_id = chat_messages.connection_user_id
        AND ti.tenant_id = chat_messages.tenant_id
        AND ti.integration_type IN ('green_api', 'manus_wa')
        AND ti.is_active = true
        AND ti.connection_visibility = 'org'
    )
  )
  OR
  -- User has explicit permission on the integration (connection_visibility = 'shared')
  (
    tenant_id = get_user_tenant_id(auth.uid())
    AND (is_blocked IS NULL OR is_blocked = false)
    AND EXISTS (
      SELECT 1
      FROM public.tenant_integrations ti
      JOIN public.integration_user_permissions iup ON iup.integration_id = ti.id
      WHERE ti.user_id = chat_messages.connection_user_id
        AND ti.tenant_id = chat_messages.tenant_id
        AND ti.integration_type IN ('green_api', 'manus_wa')
        AND ti.is_active = true
        AND iup.user_id = auth.uid()
    )
  )
);

-- Also update INSERT policy to allow inserting on behalf of shared connections
DROP POLICY IF EXISTS "Users insert own connection messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can insert chat_messages in their tenant" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can insert messages through their connection" ON public.chat_messages;

CREATE POLICY "Users insert chat messages with connection access"
ON public.chat_messages FOR INSERT TO authenticated
WITH CHECK (
  tenant_id = get_user_tenant_id(auth.uid())
  AND (
    -- Own connection
    connection_user_id = auth.uid()
    OR
    -- Org-visible integration
    EXISTS (
      SELECT 1 FROM public.tenant_integrations ti
      WHERE ti.user_id = connection_user_id
        AND ti.tenant_id = chat_messages.tenant_id
        AND ti.integration_type IN ('green_api', 'manus_wa')
        AND ti.is_active = true
        AND ti.connection_visibility = 'org'
    )
    OR
    -- Explicit permission
    EXISTS (
      SELECT 1
      FROM public.tenant_integrations ti
      JOIN public.integration_user_permissions iup ON iup.integration_id = ti.id
      WHERE ti.user_id = connection_user_id
        AND ti.tenant_id = chat_messages.tenant_id
        AND ti.integration_type IN ('green_api', 'manus_wa')
        AND ti.is_active = true
        AND iup.user_id = auth.uid()
    )
  )
);
