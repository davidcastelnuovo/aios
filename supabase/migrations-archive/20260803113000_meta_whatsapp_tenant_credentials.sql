-- Keep one onboarding credential per tenant. It is used only by service-role
-- edge functions to discover and add any WABA/phone later assigned to the same
-- Meta system user. Runtime sends continue using the per-integration token rows.
CREATE TABLE IF NOT EXISTS public.meta_whatsapp_tenant_credentials (
  tenant_id uuid PRIMARY KEY
    REFERENCES public.tenants(id) ON DELETE CASCADE,
  access_token text NOT NULL,
  token_type text,
  api_token_last_4 text,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.meta_whatsapp_tenant_credentials ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.meta_whatsapp_tenant_credentials FROM anon, authenticated;
GRANT ALL ON TABLE public.meta_whatsapp_tenant_credentials TO service_role;

-- Backfill from the most recently refreshed Meta connection so existing
-- organizations can immediately discover newly assigned numbers without
-- pasting their token again.
INSERT INTO public.meta_whatsapp_tenant_credentials (
  tenant_id,
  access_token,
  token_type,
  api_token_last_4,
  updated_by,
  created_at,
  updated_at
)
SELECT DISTINCT ON (ti.tenant_id)
  ti.tenant_id,
  mt.access_token,
  NULL,
  right(mt.access_token, 4),
  ti.user_id,
  mt.created_at,
  mt.updated_at
FROM public.meta_whatsapp_tokens mt
JOIN public.tenant_integrations ti ON ti.id = mt.integration_id
WHERE ti.integration_type = 'meta_whatsapp'
ORDER BY ti.tenant_id, mt.updated_at DESC
ON CONFLICT (tenant_id) DO NOTHING;
