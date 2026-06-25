-- Per-tenant broadcast sender domains. Each org configures its own Resend-verified
-- sending domain(s); the wizard reads these instead of a hardcoded constant.
CREATE TABLE public.broadcast_email_domains (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  domain TEXT NOT NULL,                       -- e.g. pdpsagot.co.il (verified in Resend)
  from_name TEXT,                             -- default sender display name
  default_local TEXT NOT NULL DEFAULT 'noreply', -- local-part for the default From
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bedomains_tenant ON public.broadcast_email_domains(tenant_id);
CREATE UNIQUE INDEX uq_bedomains_tenant_domain ON public.broadcast_email_domains(tenant_id, domain);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.broadcast_email_domains TO authenticated;
GRANT ALL ON public.broadcast_email_domains TO service_role;
ALTER TABLE public.broadcast_email_domains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bedomains_tenant_select" ON public.broadcast_email_domains FOR SELECT TO authenticated
  USING (tenant_id = public.get_effective_tenant_id() OR public.is_super_admin(auth.uid()));
CREATE POLICY "bedomains_tenant_insert" ON public.broadcast_email_domains FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_effective_tenant_id() OR public.is_super_admin(auth.uid()));
CREATE POLICY "bedomains_tenant_update" ON public.broadcast_email_domains FOR UPDATE TO authenticated
  USING (tenant_id = public.get_effective_tenant_id() OR public.is_super_admin(auth.uid()))
  WITH CHECK (tenant_id = public.get_effective_tenant_id() OR public.is_super_admin(auth.uid()));
CREATE POLICY "bedomains_tenant_delete" ON public.broadcast_email_domains FOR DELETE TO authenticated
  USING (tenant_id = public.get_effective_tenant_id() OR public.is_super_admin(auth.uid()));
