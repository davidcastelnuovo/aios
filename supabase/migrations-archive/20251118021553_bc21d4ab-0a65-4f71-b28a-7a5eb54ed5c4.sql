-- Add is_blocked column to whatsapp_groups table
ALTER TABLE public.whatsapp_groups 
ADD COLUMN IF NOT EXISTS is_blocked boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.whatsapp_groups.is_blocked IS 'When true, messages from this group will not be saved to the database';