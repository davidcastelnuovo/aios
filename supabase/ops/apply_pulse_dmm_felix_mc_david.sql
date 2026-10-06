-- Ops: route automated pulse digests — DMM to Felix, Marketing Captain to David.
-- Enable per-campaigner scoped delivery on DMM (+ team managers).
-- Clear preview phone so David does not get scoped preview copies from DMM.

UPDATE public.tenant_heartbeat_settings ths
SET
  campaign_pulse_deliver_to_campaigners = true,
  campaign_pulse_deliver_to_team_managers = true,
  campaign_pulse_preview_phone = NULL,
  campaign_pulse_phone = '972558833168'
FROM public.tenants t
WHERE ths.tenant_id = t.id
  AND t.slug = 'dmm';

UPDATE public.tenant_heartbeat_settings ths
SET
  campaign_pulse_deliver_to_campaigners = true,
  campaign_pulse_deliver_to_team_managers = true,
  campaign_pulse_preview_phone = NULL,
  campaign_pulse_phone = '972507677613'
FROM public.tenants t
WHERE ths.tenant_id = t.id
  AND t.slug = 'marketingcaptain';
