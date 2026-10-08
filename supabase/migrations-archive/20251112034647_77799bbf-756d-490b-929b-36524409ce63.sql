-- Update handle_lead_to_onboarding: use valid enum value for tasks.task_type ('other')
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
  -- Only proceed if status changed to transferred_to_onboarding
  IF NEW.status = 'transferred_to_onboarding' AND (OLD.status IS NULL OR OLD.status != 'transferred_to_onboarding') THEN
    
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
      folder_link
    ) VALUES (
      NEW.company_name,
      NEW.agency_id,
      NEW.email,
      NEW.phone,
      NEW.industry,
      'נוצר מליד: ' || COALESCE(NEW.notes, ''),
      'onboarding',
      NEW.folder_link
    ) RETURNING id INTO new_client_id;
    
    -- Create client_onboarding entry
    IF david_campaigner_id IS NOT NULL THEN
      INSERT INTO public.client_onboarding (
        client_id,
        agency_id,
        campaigner_id,
        title,
        status,
        notes
      ) VALUES (
        new_client_id,
        NEW.agency_id,
        david_campaigner_id,
        'קליטת לקוח: ' || NEW.company_name,
        'research_meeting',
        'נוצר אוטומטית מליד'
      );
      
      -- Create task for David (priority is integer 1..10; 8=high)
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