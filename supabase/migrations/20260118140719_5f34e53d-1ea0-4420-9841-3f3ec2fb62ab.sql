-- Add missing 'closed' pipeline stage for realeasy tenant (prevents leads from disappearing)
INSERT INTO public.lead_pipeline_stages (tenant_id, stage_key, label, color, sort_order, is_active)
SELECT
  '8a38496c-c000-44a0-848f-9833778faf70'::uuid,
  'closed',
  'נסגר',
  '#10b981',
  4,
  true
WHERE NOT EXISTS (
  SELECT 1
  FROM public.lead_pipeline_stages
  WHERE tenant_id = '8a38496c-c000-44a0-848f-9833778faf70'::uuid
    AND stage_key = 'closed'
);
