-- Backfill cached source metadata on facebook_lead_ads mirror rows
-- so receiving-tenant users see the shared-connection banner without
-- cross-tenant reads on tenant_integrations.

UPDATE public.tenant_integrations AS mirror
SET settings = COALESCE(mirror.settings, '{}'::jsonb) || jsonb_build_object(
  'shared', true,
  'shared_from_tenant_name', source_tenant.name,
  'shared_page_name', COALESCE(source.settings->>'page_name', NULL)
)
FROM public.tenant_integrations AS source
JOIN public.tenants AS source_tenant ON source_tenant.id = source.tenant_id
WHERE mirror.shared_from_integration_id = source.id
  AND mirror.integration_type = 'facebook_lead_ads'
  AND mirror.is_active = true
  AND source.is_active = true;
