-- Fix security issue: Add search_path to trigger function
CREATE OR REPLACE FUNCTION public.trigger_validate_crm_record()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.validate_crm_record(NEW.table_id, NEW.data);
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;