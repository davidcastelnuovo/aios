-- Move ecommerce report tables into the canonical "איקומרס" list category.
-- Safe, scoped UPDATE — only rows that are already ecommerce by type/settings.

UPDATE public.crm_tables
SET category = 'איקומרס',
    updated_at = now()
WHERE integration_type = 'facebook_ecommerce'
  AND coalesce(category, '') IS DISTINCT FROM 'איקומרס';

UPDATE public.crm_tables
SET category = 'איקומרס',
    updated_at = now()
WHERE integration_type = 'google_ads'
  AND lower(coalesce(integration_settings->>'campaign_type', '')) = 'ecommerce'
  AND coalesce(category, '') IS DISTINCT FROM 'איקומרס';

INSERT INTO public.claude_carmen_audit (actor, action, target, details)
VALUES (
  'claude',
  'backfill_crm_tables_ecommerce_category',
  'crm_tables',
  jsonb_build_object(
    'category', 'איקומרס',
    'rule', 'facebook_ecommerce + google_ads campaign_type=ecommerce'
  )
);
