
CREATE TABLE public.ahrefs_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  agency_id uuid REFERENCES public.agencies(id) ON DELETE SET NULL,
  domain text NOT NULL,
  report_type text NOT NULL,
  report_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  report_date date,
  received_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ahrefs_reports_tenant_id ON public.ahrefs_reports(tenant_id);
CREATE INDEX idx_ahrefs_reports_domain ON public.ahrefs_reports(domain);
CREATE INDEX idx_ahrefs_reports_report_type ON public.ahrefs_reports(report_type);
CREATE INDEX idx_ahrefs_reports_client_id ON public.ahrefs_reports(client_id);

ALTER TABLE public.ahrefs_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view ahrefs_reports in their tenant"
  ON public.ahrefs_reports FOR SELECT TO authenticated
  USING (
    tenant_id = public.get_effective_tenant_id()
    OR public.is_super_admin(auth.uid())
  );

CREATE POLICY "Users can insert ahrefs_reports in their tenant"
  ON public.ahrefs_reports FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.get_effective_tenant_id()
    OR public.is_super_admin(auth.uid())
  );

CREATE POLICY "Users can delete ahrefs_reports in their tenant"
  ON public.ahrefs_reports FOR DELETE TO authenticated
  USING (
    tenant_id = public.get_effective_tenant_id()
    OR public.is_super_admin(auth.uid())
  );

CREATE POLICY "Service role can manage ahrefs_reports"
  ON public.ahrefs_reports FOR ALL TO service_role
  USING (true) WITH CHECK (true);
