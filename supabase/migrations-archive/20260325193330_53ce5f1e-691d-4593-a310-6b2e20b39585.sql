
CREATE TABLE public.dashboard_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_id uuid NOT NULL REFERENCES public.crm_dashboards(id) ON DELETE CASCADE,
  share_token text NOT NULL UNIQUE DEFAULT substr(md5(random()::text || clock_timestamp()::text), 1, 24),
  allowed_emails text[] DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.dashboard_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own shares"
  ON public.dashboard_shares
  FOR ALL
  TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    OR is_super_admin(auth.uid())
  )
  WITH CHECK (
    tenant_id = get_user_tenant_id(auth.uid())
    OR is_super_admin(auth.uid())
  );

CREATE INDEX idx_dashboard_shares_token ON public.dashboard_shares(share_token);
CREATE INDEX idx_dashboard_shares_dashboard ON public.dashboard_shares(dashboard_id);
