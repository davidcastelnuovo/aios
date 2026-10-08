
ALTER TABLE public.team_channels 
ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'team';
