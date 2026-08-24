-- Enable per-campaigner pulse delivery + David preview on DMM and Marketing Captain.

ALTER TABLE public.tenant_heartbeat_settings
  ADD COLUMN IF NOT EXISTS campaign_pulse_deliver_to_campaigners boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS campaign_pulse_deliver_to_team_managers boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS campaign_pulse_preview_phone text;

COMMENT ON COLUMN public.tenant_heartbeat_settings.campaign_pulse_deliver_to_campaigners IS
  'When true, scoped pulse digests are sent to each active campaigner (client_team assignments).';
COMMENT ON COLUMN public.tenant_heartbeat_settings.campaign_pulse_deliver_to_team_managers IS
  'When true (DMM), scoped pulse digests are also sent to team managers for their managed agencies.';
COMMENT ON COLUMN public.tenant_heartbeat_settings.campaign_pulse_preview_phone IS
  'Owner phone that receives a preview of each scoped digest immediately before it is sent to the campaigner/manager.';

UPDATE public.tenant_heartbeat_settings ths
SET
  campaign_pulse_deliver_to_campaigners = true,
  campaign_pulse_preview_phone = '972507677613',
  campaign_pulse_deliver_to_team_managers = (t.slug = 'dmm')
FROM public.tenants t
WHERE ths.tenant_id = t.id
  AND t.slug IN ('dmm', 'marketingcaptain');
