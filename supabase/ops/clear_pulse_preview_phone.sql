-- Ops: remove owner preview copies before per-campaigner pulse delivery.
UPDATE public.tenant_heartbeat_settings ths
SET campaign_pulse_preview_phone = NULL
FROM public.tenants t
WHERE ths.tenant_id = t.id
  AND t.slug IN ('dmm', 'marketingcaptain')
  AND ths.campaign_pulse_preview_phone IS NOT NULL;
