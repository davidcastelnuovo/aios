-- Ops: route automated pulse digests — DMM to Felix, Marketing Captain to David.
-- Clear preview phone on both tenants so David does not get scoped preview copies from DMM.

UPDATE public.tenant_heartbeat_settings ths
SET
  campaign_pulse_preview_phone = NULL,
  campaign_pulse_phone = '972558833168'
FROM public.tenants t
WHERE ths.tenant_id = t.id
  AND t.slug = 'dmm';

UPDATE public.tenant_heartbeat_settings ths
SET
  campaign_pulse_preview_phone = NULL,
  campaign_pulse_phone = '972507677613'
FROM public.tenants t
WHERE ths.tenant_id = t.id
  AND t.slug = 'marketingcaptain';
