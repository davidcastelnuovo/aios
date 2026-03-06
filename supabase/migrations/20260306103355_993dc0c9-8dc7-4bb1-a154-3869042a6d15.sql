
ALTER TABLE public.team_channels 
ADD COLUMN IF NOT EXISTS notification_group_link text;

ALTER TABLE public.team_channel_members 
ADD COLUMN IF NOT EXISTS notify_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS notify_override_phone text,
ADD COLUMN IF NOT EXISTS notify_override_group text;
