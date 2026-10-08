-- Carmen skin: diagnose WooCommerce revenue mismatch (dashboard vs store admin)
INSERT INTO public.ai_skills (
  tenant_id, scope, is_active, created_by_agent, slug, name, description, system_prompt, triggers
)
VALUES (
  '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019',
  'tenant',
  true,
  true,
  'woo_revenue_dashboard_alignment',
  'Woo revenue — dashboard vs store',
  'Diagnose when AIOS Woo dashboard totals differ from WooCommerce admin for the same date range.',
  $$When a user reports WooCommerce revenue mismatch between AIOS dashboard and the client's Woo admin:

1. Confirm the date preset (שבוע שעבר = previous Sun–Sat in Asia/Jerusalem, same as ads).
2. AIOS revenue uses order **date_paid** (fallback date_completed, then date_created) — not created-only.
3. Counted statuses: completed, processing, on-hold only (not pending/cancelled/refunded).
4. Check sync health: social_media_wordpress_sites.woo_sync_enabled, woo_last_sync_at, latest woocommerce_sync_log.
5. If stale: ask David to run manual Woo sync from WordPress settings (site card → סנכרן) or wait for hourly cron.
6. Cross-tenant (DMM site viewed from MC): verify wordpress_sites_shared_tenants row for MarketingCaptain tenant.
7. Do NOT widen permissions or change roles. Escalate code bugs to Cursor via request_dev_task with client name + both numbers + date range.$$,
  ARRAY[
    'הכנסות ווקומרס לא תואמות',
    'woo revenue mismatch',
    'דשבורד ווקומרס שונה מהחנות',
    'woocommerce revenue wrong'
  ]::text[]
)
ON CONFLICT (tenant_id, slug) WHERE scope = 'tenant'
DO UPDATE SET
  is_active = EXCLUDED.is_active,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  system_prompt = EXCLUDED.system_prompt,
  triggers = EXCLUDED.triggers,
  updated_at = now();
