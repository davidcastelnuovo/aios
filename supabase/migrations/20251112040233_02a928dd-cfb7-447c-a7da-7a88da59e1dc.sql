-- Update handle_lead_to_onboarding to NOT automatically assign campaigner
-- Let user choose campaigner manually
CREATE OR REPLACE FUNCTION public.handle_lead_to_onboarding()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_client_id uuid;
BEGIN
  -- Only proceed if won_date was just set on a closed lead
  -- AND we haven't already created a client
  IF NEW.status = 'closed' 
     AND NEW.won_date IS NOT NULL 
     AND (OLD.won_date IS NULL OR OLD.won_date != NEW.won_date)
     AND NOT EXISTS (
       SELECT 1 FROM public.clients 
       WHERE name = NEW.company_name 
       AND agency_id = NEW.agency_id 
       AND notes LIKE 'נוצר מליד:%'
       AND created_at > NOW() - INTERVAL '5 minutes'
     ) THEN
    
    -- Create new client with lead details
    INSERT INTO public.clients (
      name,
      agency_id,
      email,
      phone,
      industry,
      notes,
      status,
      folder_link,
      tenant_id
    ) VALUES (
      NEW.company_name,
      NEW.agency_id,
      NEW.email,
      NEW.phone,
      NEW.industry,
      'נוצר מליד: ' || COALESCE(NEW.notes, ''),
      'onboarding',
      NEW.folder_link,
      NEW.tenant_id
    ) RETURNING id INTO new_client_id;
    
    -- Note: We don't create client_onboarding or task here anymore
    -- User will manually assign campaigner in the UI
    
  END IF;
  
  RETURN NEW;
END;
$function$;