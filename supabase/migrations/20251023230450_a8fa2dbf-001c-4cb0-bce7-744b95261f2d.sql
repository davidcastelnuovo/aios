-- Add 'transferred_to_onboarding' status to lead_status enum
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'transferred_to_onboarding';

-- Create function to handle lead transfer to onboarding
CREATE OR REPLACE FUNCTION public.handle_lead_to_onboarding()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
        due_date
      ) VALUES (
        'קליטת לקוח: ' || NEW.company_name,
        new_client_id,
        NEW.agency_id,
        david_campaigner_id,
        'open',
        'high',
        'client_onboarding',
        'ליד הועבר לקליטה. איש קשר: ' || COALESCE(NEW.contact_name, '') || '. טלפון: ' || COALESCE(NEW.phone, '') || '. אימייל: ' || COALESCE(NEW.email, ''),
        CURRENT_DATE + INTERVAL '3 days'
      );
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS on_lead_transferred_to_onboarding ON public.leads;

-- Create trigger
CREATE TRIGGER on_lead_transferred_to_onboarding
  AFTER UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_lead_to_onboarding();