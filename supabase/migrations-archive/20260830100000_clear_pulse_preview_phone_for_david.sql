-- Stop sending David a preview copy before each campaigner/manager pulse digest.
-- Campaigners still receive their scoped morning digest (client_team) with dashboard link.
-- Felix (campaign_pulse_phone) keeps the full-tenant digest.

UPDATE public.tenant_heartbeat_settings ths
SET campaign_pulse_preview_phone = NULL
FROM public.tenants t
WHERE ths.tenant_id = t.id
  AND t.slug IN ('dmm', 'marketingcaptain')
  AND ths.campaign_pulse_preview_phone IS NOT NULL;
