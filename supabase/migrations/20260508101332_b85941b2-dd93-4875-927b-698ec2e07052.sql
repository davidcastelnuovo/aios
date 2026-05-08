CREATE TABLE public.seo_call_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  client_id UUID NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('organic','paid')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  incoming_count INTEGER NOT NULL DEFAULT 0,
  is_manual BOOLEAN NOT NULL DEFAULT false,
  note TEXT,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, client_id, category, period_start, period_end)
);

CREATE INDEX idx_seo_call_snapshots_lookup
  ON public.seo_call_snapshots (tenant_id, client_id, category);

ALTER TABLE public.seo_call_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read snapshots in tenant or shared agency"
  ON public.seo_call_snapshots FOR SELECT
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    OR public.is_super_admin(auth.uid())
    OR public.user_has_cross_tenant_client_access(auth.uid(), client_id)
  );

CREATE POLICY "Insert snapshots in tenant or shared agency"
  ON public.seo_call_snapshots FOR INSERT
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid())
    OR public.is_super_admin(auth.uid())
    OR public.user_has_cross_tenant_client_access(auth.uid(), client_id)
  );

CREATE POLICY "Update snapshots in tenant or shared agency"
  ON public.seo_call_snapshots FOR UPDATE
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    OR public.is_super_admin(auth.uid())
    OR public.user_has_cross_tenant_client_access(auth.uid(), client_id)
  );

CREATE POLICY "Delete snapshots in tenant or shared agency"
  ON public.seo_call_snapshots FOR DELETE
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    OR public.is_super_admin(auth.uid())
    OR public.user_has_cross_tenant_client_access(auth.uid(), client_id)
  );

CREATE TRIGGER seo_call_snapshots_updated_at
  BEFORE UPDATE ON public.seo_call_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();