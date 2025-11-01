-- Add calendar_iframe_code field to profiles table
ALTER TABLE public.profiles 
ADD COLUMN calendar_iframe_code text;

COMMENT ON COLUMN public.profiles.calendar_iframe_code IS 'Google Calendar iframe embed code for user personal calendar';