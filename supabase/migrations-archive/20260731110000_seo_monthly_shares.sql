-- Shareable SEO monthly slideshow: frozen snapshot + public token.
-- Public reads go through the public-seo-monthly edge function (service role).

CREATE TABLE IF NOT EXISTS public.seo_monthly_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  share_token TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex') UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_id, month)
);

CREATE INDEX IF NOT EXISTS idx_seo_monthly_shares_token
  ON public.seo_monthly_shares (share_token)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_seo_monthly_shares_client
  ON public.seo_monthly_shares (client_id, month DESC);

ALTER TABLE public.seo_monthly_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "seo_monthly_shares_tenant_access" ON public.seo_monthly_shares;
CREATE POLICY "seo_monthly_shares_tenant_access"
ON public.seo_monthly_shares FOR ALL TO authenticated
USING (
  tenant_id IN (SELECT tu.tenant_id FROM tenant_users tu WHERE tu.user_id = auth.uid())
  OR is_super_admin(auth.uid())
  OR user_has_cross_tenant_client_access(auth.uid(), client_id)
)
WITH CHECK (
  tenant_id IN (SELECT tu.tenant_id FROM tenant_users tu WHERE tu.user_id = auth.uid())
  OR is_super_admin(auth.uid())
  OR user_has_cross_tenant_client_access(auth.uid(), client_id)
);

COMMENT ON TABLE public.seo_monthly_shares IS
  'Public slideshow shares for SEO monthly work reports. snapshot is frozen at share/update time.';
