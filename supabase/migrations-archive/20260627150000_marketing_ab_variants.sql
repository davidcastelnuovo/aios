-- Create marketing_ab_variants table (referenced by ABTestPanel but never created)
CREATE TABLE IF NOT EXISTS public.marketing_ab_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  work_item_id uuid NOT NULL REFERENCES public.marketing_work_items(id) ON DELETE CASCADE,
  stage_id uuid REFERENCES public.marketing_pipeline_stages(id) ON DELETE SET NULL,
  content text NOT NULL,
  label text,
  selected boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.marketing_ab_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "marketing_ab_variants_select" ON public.marketing_ab_variants
  FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "marketing_ab_variants_write" ON public.marketing_ab_variants
  FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "marketing_ab_variants_update" ON public.marketing_ab_variants
  FOR UPDATE USING (tenant_id IN (
    SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
  ));

CREATE POLICY "marketing_ab_variants_delete" ON public.marketing_ab_variants
  FOR DELETE USING (tenant_id IN (
    SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
  ));

CREATE INDEX IF NOT EXISTS idx_marketing_ab_variants_work_item ON public.marketing_ab_variants(work_item_id);
