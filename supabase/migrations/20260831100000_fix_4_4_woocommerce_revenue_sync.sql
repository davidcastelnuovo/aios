-- 4/4 ארבע על ארבע: ensure hourly Woo sync runs (same class of fix as Avieli/Bilbi).
-- Safe scoped UPDATE — only sites already linked to this client with Woo enabled.

UPDATE public.social_media_wordpress_sites s
SET woo_sync_enabled = true
FROM public.clients c
WHERE s.client_id = c.id
  AND (
    c.name ILIKE '%4/4%'
    OR c.name ILIKE '%ארבע על ארבע%'
  )
  AND s.woocommerce_enabled = true
  AND s.is_active = true;

-- Share DMM-hosted WP sites with MarketingCaptain when the client is viewed cross-tenant.
INSERT INTO public.wordpress_sites_shared_tenants (site_id, tenant_id)
SELECT s.id, '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'::uuid
FROM public.social_media_wordpress_sites s
JOIN public.clients c ON c.id = s.client_id
WHERE (
    c.name ILIKE '%4/4%'
    OR c.name ILIKE '%ארבע על ארבע%'
  )
  AND s.woocommerce_enabled = true
  AND s.is_active = true
ON CONFLICT (site_id, tenant_id) DO NOTHING;

INSERT INTO public.claude_carmen_audit (tenant_id, actor, action, target, details)
SELECT
  '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'::uuid,
  'carmen',
  'woo_4_4_revenue_sync_enable',
  'social_media_wordpress_sites:' || s.id::text,
  jsonb_build_object(
    'client_id', c.id,
    'client_name', c.name,
    'site_url', s.site_url,
    'woo_sync_enabled', true
  )
FROM public.social_media_wordpress_sites s
JOIN public.clients c ON c.id = s.client_id
WHERE (
    c.name ILIKE '%4/4%'
    OR c.name ILIKE '%ארבע על ארבע%'
  )
  AND s.woocommerce_enabled = true
  AND s.is_active = true;
