-- Pulse WhatsApp routing: DMM → Felix only; Marketing Captain → David.
-- Enable per-campaigner scoped delivery. Clear preview copies to David.

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
