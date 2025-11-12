-- Update handle_lead_to_onboarding to trigger on won_date update for closed leads
-- This way the lead stays "closed" but still creates client/task
DROP TRIGGER IF EXISTS on_lead_status_to_onboarding ON public.leads;

CREATE OR REPLACE FUNCTION public.handle_lead_to_onboarding()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_client_id uuid;
  david_campaigner_id uuid;
BEGIN
  -- Only proceed if won_date was just set on a closed lead
  -- AND we haven't already created a client (check if there's already a client with this lead info)
  IF NEW.status = 'closed' 
     AND NEW.won_date IS NOT NULL 
     AND (OLD.won_date IS NULL OR OLD.won_date != NEW.won_date)
     AND NOT EXISTS (
       SELECT 1 FROM public.clients 
       WHERE name = NEW.company_name 
       AND agency_id = NEW.agency_id 
       AND notes LIKE 'נוצר מליד:%'
     ) THEN
    
    -- Get David Kastelnuov's campaigner_id (by name)
    SELECT id INTO david_campaigner_id
    FROM public.campaigners
    WHERE full_name ILIKE '%דוד%קסטלנואוב%'
    LIMIT 1;
    
    -- If David not found, get first active campaigner
    IF david_campaigner_id IS NULL THEN
      SELECT id INTO david_campaigner_id
      FROM public.campaigners
      WHERE active = true
      LIMIT 1;
    END IF;
    
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
    
    -- Create client_onboarding entry
    IF david_campaigner_id IS NOT NULL THEN
      INSERT INTO public.client_onboarding (
        client_id,
        agency_id,
        campaigner_id,
        title,
        status,
        notes,
        tenant_id
      ) VALUES (
        new_client_id,
        NEW.agency_id,
        david_campaigner_id,
        'קליטת לקוח: ' || NEW.company_name,
        'research_meeting',
        'נוצר אוטומטית מליד',
        NEW.tenant_id
      );
      
      -- Create task for David
      INSERT INTO public.tasks (
        title,
        client_id,
        agency_id,
        campaigner_id,
        status,
        priority,
        task_type,
        notes,
        due_date,
        tenant_id
      ) VALUES (
        'קליטת לקוח: ' || NEW.company_name,
        new_client_id,
        NEW.agency_id,
        david_campaigner_id,
        'open',
        8,
        'other',
        'ליד הועבר לקליטה. איש קשר: ' || COALESCE(NEW.contact_name, '') || '. טלפון: ' || COALESCE(NEW.phone, '') || '. אימייל: ' || COALESCE(NEW.email, ''),
        CURRENT_DATE + INTERVAL '3 days',
        NEW.tenant_id
      );
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger on UPDATE of won_date
CREATE TRIGGER on_lead_won_date_update
  AFTER UPDATE OF won_date ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_lead_to_onboarding();