-- Maskyoo telephony integration
CREATE TABLE IF NOT EXISTS public.maskyoo_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL UNIQUE,
  base_url text NOT NULL,
  api_token text NOT NULL,
  default_user_phone text,
  click2call_service text NOT NULL DEFAULT 'onetouch',
  webhook_secret text,
  last_cdr_sync_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.maskyoo_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members read maskyoo settings"
ON public.maskyoo_settings FOR SELECT
USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Tenant owners manage maskyoo settings"
ON public.maskyoo_settings FOR ALL
USING (
  (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'owner'::app_role))
  OR is_super_admin(auth.uid())
)
WITH CHECK (
  (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'owner'::app_role))
  OR is_super_admin(auth.uid())
);

CREATE TRIGGER update_maskyoo_settings_updated_at
BEFORE UPDATE ON public.maskyoo_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add provider column default options to telephony_settings (already exists with 'provider' text)
-- Track maskyoo cdr_uniqueid mapping; provider_call_id already exists in call_logs.
CREATE INDEX IF NOT EXISTS idx_call_logs_provider_call_id ON public.call_logs(provider_call_id) WHERE provider_call_id IS NOT NULL;