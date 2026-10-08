-- Update handle_lead_to_onboarding to create client_onboarding without campaigner
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
    
    -- Create empty client_onboarding record without campaigner
    -- User will assign campaigner manually
    INSERT INTO public.client_onboarding (
      client_id,
      agency_id,
      campaigner_id,
      title,
      status,
      notes,
      tenant_id
    ) SELECT
      new_client_id,
      NEW.agency_id,
      (SELECT id FROM public.campaigners WHERE full_name = 'דוד' AND active = true LIMIT 1),
      'קליטת לקוח: ' || NEW.company_name,
      'research_meeting',
      'נוצר אוטומטית מליד - נא לבחור קמפיינר',
      NEW.tenant_id
    WHERE EXISTS (SELECT 1 FROM public.campaigners WHERE full_name = 'דוד' AND active = true);
    
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Update handle_client_onboarding_status to use דוד as default
CREATE OR REPLACE FUNCTION public.handle_client_onboarding_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  default_campaigner_id uuid;
BEGIN
  -- When status changes to onboarding, create an onboarding entry if it doesn't exist
  IF NEW.status = 'onboarding' AND (OLD.status IS NULL OR OLD.status != 'onboarding') THEN
    -- Check if onboarding entry already exists for this client (non-campaign_live)
    IF NOT EXISTS (
      SELECT 1 FROM public.client_onboarding 
      WHERE client_id = NEW.id 
      AND status != 'campaign_live'
    ) THEN
      -- Try to get דוד as default campaigner
      SELECT id INTO default_campaigner_id
      FROM public.campaigners
      WHERE full_name = 'דוד'
      AND active = true
      LIMIT 1;
      
      -- If דוד not found, try client_team
      IF default_campaigner_id IS NULL THEN
        SELECT campaigner_id INTO default_campaigner_id
        FROM public.client_team
        WHERE client_id = NEW.id
        LIMIT 1;
      END IF;
      
      -- If still no campaigner, get first active one
      IF default_campaigner_id IS NULL THEN
        SELECT id INTO default_campaigner_id
        FROM public.campaigners
        WHERE active = true
        LIMIT 1;
      END IF;
      
      -- Create onboarding entry with tenant_id
      IF default_campaigner_id IS NOT NULL THEN
        INSERT INTO public.client_onboarding (
          client_id,
          agency_id,
          campaigner_id,
          title,
          status,
          notes,
          tenant_id
        ) VALUES (
          NEW.id,
          NEW.agency_id,
          default_campaigner_id,
          'קליטת לקוח: ' || NEW.name,
          'research_meeting',
          'נוצר אוטומטית מעדכון סטטוס לקוח',
          NEW.tenant_id
        );
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;