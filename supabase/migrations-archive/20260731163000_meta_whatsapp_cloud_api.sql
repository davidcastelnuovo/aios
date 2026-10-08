-- Official Meta WhatsApp Cloud API / Embedded Signup.
-- Additive: existing Green API, Manus WA and ManyChat integrations are unchanged.

ALTER TYPE public.chat_provider ADD VALUE IF NOT EXISTS 'meta_whatsapp';

-- Customer-scoped Meta business tokens must never be readable through the
-- tenant_integrations API. Only service-role edge functions can access them.
CREATE TABLE IF NOT EXISTS public.meta_whatsapp_tokens (
  integration_id uuid PRIMARY KEY
    REFERENCES public.tenant_integrations(id) ON DELETE CASCADE,
  access_token text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.meta_whatsapp_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.meta_whatsapp_tokens FROM anon, authenticated;
GRANT ALL ON TABLE public.meta_whatsapp_tokens TO service_role;

ALTER TABLE public.chat_messages
ADD COLUMN IF NOT EXISTS integration_id uuid
REFERENCES public.tenant_integrations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS chat_messages_integration_id_idx
ON public.chat_messages (integration_id, created_at DESC)
WHERE integration_id IS NOT NULL;

-- Meta Embedded Signup can return more than one phone number for the same user.
DROP INDEX IF EXISTS public.tenant_integrations_user_level_unique;

CREATE UNIQUE INDEX IF NOT EXISTS tenant_integrations_user_level_unique
ON public.tenant_integrations (tenant_id, integration_type, user_id)
WHERE user_id IS NOT NULL
  AND integration_type NOT IN ('google_analytics', 'meta_whatsapp');

CREATE UNIQUE INDEX IF NOT EXISTS tenant_integrations_meta_wa_phone_unique
ON public.tenant_integrations (
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
      WHERE (
          ti.id = chat_messages.integration_id
          OR (
            chat_messages.integration_id IS NULL
            AND ti.user_id = chat_messages.connection_user_id
            AND ti.integration_type IN ('green_api', 'manus_wa')
          )
        )
        AND ti.tenant_id = chat_messages.tenant_id
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
      WHERE (
          ti.id = chat_messages.integration_id
          OR (
            chat_messages.integration_id IS NULL
            AND ti.user_id = chat_messages.connection_user_id
            AND ti.integration_type IN ('green_api', 'manus_wa')
          )
        )
        AND ti.tenant_id = chat_messages.tenant_id
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
      WHERE (
          ti.id = chat_messages.integration_id
          OR (
            chat_messages.integration_id IS NULL
            AND ti.user_id = connection_user_id
            AND ti.integration_type IN ('green_api', 'manus_wa')
          )
        )
        AND ti.tenant_id = chat_messages.tenant_id
        AND ti.is_active = true
        AND ti.connection_visibility = 'org'
    )
    OR EXISTS (
      SELECT 1
      FROM public.tenant_integrations ti
      JOIN public.integration_user_permissions iup ON iup.integration_id = ti.id
      WHERE (
          ti.id = chat_messages.integration_id
          OR (
            chat_messages.integration_id IS NULL
            AND ti.user_id = connection_user_id
            AND ti.integration_type IN ('green_api', 'manus_wa')
          )
        )
        AND ti.tenant_id = chat_messages.tenant_id
        AND ti.is_active = true
        AND iup.user_id = auth.uid()
    )
  )
);
