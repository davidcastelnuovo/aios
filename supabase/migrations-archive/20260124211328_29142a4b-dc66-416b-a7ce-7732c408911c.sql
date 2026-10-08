-- Fix the trigger to handle empty strings as well as NULL
CREATE OR REPLACE FUNCTION public.set_tracking_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.tracking_id IS NULL OR NEW.tracking_id = '' THEN
    NEW.tracking_id := generate_tracking_id();
  END IF;
  RETURN NEW;
END;
$$;

-- Generate tracking_id for existing records with empty values
UPDATE site_tracking_configs 
SET tracking_id = public.generate_tracking_id()
WHERE tracking_id = '' OR tracking_id IS NULL;