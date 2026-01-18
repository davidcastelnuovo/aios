-- Fix function search_path for security
CREATE OR REPLACE FUNCTION public.ensure_single_default_agency()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE agencies SET is_default = false 
    WHERE tenant_id = NEW.tenant_id AND id != NEW.id AND is_default = true;
  END IF;
  RETURN NEW;
END;
$function$;