CREATE TABLE IF NOT EXISTS public.maskyoo_manual_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  maskyoo_last9 TEXT NOT NULL,
  period_days INT NOT NULL DEFAULT 30,
  incoming_count INT,
  unique_count INT,
  answered_count INT,
  note TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, maskyoo_last9, period_days)
);

CREATE INDEX IF NOT EXISTS idx_maskyoo_overrides_lookup
  ON public.maskyoo_manual_overrides (tenant_id, maskyoo_last9, period_days);

ALTER TABLE public.maskyoo_manual_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View maskyoo overrides"
ON public.maskyoo_manual_overrides FOR SELECT
USING (
  public.is_super_admin(auth.uid())
  OR tenant_id = public.get_effective_tenant_id()
  OR EXISTS (
    SELECT 1 FROM public.agency_tenant_access ata
    WHERE ata.source_tenant_id = maskyoo_manual_overrides.tenant_id
      AND ata.agency_id = ANY (public.get_user_agency_ids(auth.uid()))
  )
);

CREATE POLICY "Insert maskyoo overrides"
ON public.maskyoo_manual_overrides FOR INSERT
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR tenant_id = public.get_effective_tenant_id()
  OR EXISTS (
    SELECT 1 FROM public.agency_tenant_access ata
    WHERE ata.source_tenant_id = maskyoo_manual_overrides.tenant_id
      AND ata.agency_id = ANY (public.get_user_agency_ids(auth.uid()))
  )
);

CREATE POLICY "Update maskyoo overrides"
ON public.maskyoo_manual_overrides FOR UPDATE
USING (
  public.is_super_admin(auth.uid())
  OR tenant_id = public.get_effective_tenant_id()
  OR EXISTS (
    SELECT 1 FROM public.agency_tenant_access ata
    WHERE ata.source_tenant_id = maskyoo_manual_overrides.tenant_id
      AND ata.agency_id = ANY (public.get_user_agency_ids(auth.uid()))
  )
);

CREATE POLICY "Delete maskyoo overrides"
ON public.maskyoo_manual_overrides FOR DELETE
USING (
  public.is_super_admin(auth.uid())
  OR tenant_id = public.get_effective_tenant_id()
  OR EXISTS (
    SELECT 1 FROM public.agency_tenant_access ata
    WHERE ata.source_tenant_id = maskyoo_manual_overrides.tenant_id
      AND ata.agency_id = ANY (public.get_user_agency_ids(auth.uid()))
  )
);

CREATE TRIGGER trg_maskyoo_overrides_updated_at
  BEFORE UPDATE ON public.maskyoo_manual_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();