-- Official Meta WhatsApp Cloud API / Embedded Signup.
-- Additive: existing Green API, Manus WA and ManyChat integrations are unchanged.

ALTER TYPE public.chat_provider ADD VALUE IF NOT EXISTS 'meta_whatsapp';

-- Meta Embedded Signup can return more than one phone number for the same user.
DROP INDEX IF EXISTS public.tenant_integrations_user_level_unique;

CREATE UNIQUE INDEX IF NOT EXISTS tenant_integrations_user_level_unique
ON public.tenant_integrations (tenant_id, integration_type, user_id)
WHERE user_id IS NOT NULL
  AND integration_type NOT IN ('google_analytics', 'meta_whatsapp');

CREATE UNIQUE INDEX IF NOT EXISTS tenant_integrations_meta_wa_phone_unique
ON public.tenant_integrations (
  tenant_id,
  integration_type,
  ((settings->>'phone_number_id'))
)
WHERE integration_type = 'meta_whatsapp'
  AND (settings->>'phone_number_id') IS NOT NULL;

CREATE INDEX IF NOT EXISTS tenant_integrations_meta_wa_phone_lookup
ON public.tenant_integrations ((settings->>'phone_number_id'))
WHERE integration_type = 'meta_whatsapp' AND is_active = true;

-- Include official Meta connections in the same per-connection visibility model
-- used by Green API and Manus WA.
DROP POLICY IF EXISTS "Users view chat messages with connection access" ON public.chat_messages;

CREATE POLICY "Users view chat messages with connection access"
ON public.chat_messages FOR SELECT TO authenticated
USING (
  is_super_admin(auth.uid())
  OR (
    tenant_id = get_user_tenant_id(auth.uid())
    AND has_role(auth.uid(), 'owner'::app_role)
  )
  OR (
    connection_user_id = auth.uid()
    AND tenant_id = get_user_tenant_id(auth.uid())
    AND (is_blocked IS NULL OR is_blocked = false)
  )
  OR (
    tenant_id = get_user_tenant_id(auth.uid())
    AND (is_blocked IS NULL OR is_blocked = false)
    AND EXISTS (
      SELECT 1
      FROM public.tenant_integrations ti
      WHERE ti.user_id = chat_messages.connection_user_id
        AND ti.tenant_id = chat_messages.tenant_id
        AND ti.integration_type IN ('green_api', 'manus_wa', 'meta_whatsapp')
        AND ti.is_active = true
        AND ti.connection_visibility = 'org'
    )
  )
  OR (
    tenant_id = get_user_tenant_id(auth.uid())
    AND (is_blocked IS NULL OR is_blocked = false)
    AND EXISTS (
      SELECT 1
      FROM public.tenant_integrations ti
      JOIN public.integration_user_permissions iup ON iup.integration_id = ti.id
      WHERE ti.user_id = chat_messages.connection_user_id
        AND ti.tenant_id = chat_messages.tenant_id
        AND ti.integration_type IN ('green_api', 'manus_wa', 'meta_whatsapp')
        AND ti.is_active = true
        AND iup.user_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "Users insert chat messages with connection access" ON public.chat_messages;

CREATE POLICY "Users insert chat messages with connection access"
ON public.chat_messages FOR INSERT TO authenticated
WITH CHECK (
  tenant_id = get_user_tenant_id(auth.uid())
  AND (
    connection_user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.tenant_integrations ti
      WHERE ti.user_id = connection_user_id
        AND ti.tenant_id = chat_messages.tenant_id
        AND ti.integration_type IN ('green_api', 'manus_wa', 'meta_whatsapp')
        AND ti.is_active = true
        AND ti.connection_visibility = 'org'
    )
    OR EXISTS (
      SELECT 1
      FROM public.tenant_integrations ti
      JOIN public.integration_user_permissions iup ON iup.integration_id = ti.id
      WHERE ti.user_id = connection_user_id
        AND ti.tenant_id = chat_messages.tenant_id
        AND ti.integration_type IN ('green_api', 'manus_wa', 'meta_whatsapp')
        AND ti.is_active = true
        AND iup.user_id = auth.uid()
    )
  )
);
