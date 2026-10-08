-- Create function to automatically add client to onboarding when status changes to onboarding
CREATE OR REPLACE FUNCTION public.handle_client_onboarding_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  default_campaigner_id uuid;
BEGIN
  -- When status changes to onboarding, create an onboarding entry if it doesn't exist
  IF NEW.status = 'onboarding' AND (OLD.status IS NULL OR OLD.status != 'onboarding') THEN
    -- Check if onboarding entry already exists for this client
    IF NOT EXISTS (
      SELECT 1 FROM public.client_onboarding 
      WHERE client_id = NEW.id 
      AND status != 'campaign_live'
    ) THEN
      -- Try to get a campaigner from client_team
      SELECT campaigner_id INTO default_campaigner_id
      FROM public.client_team
      WHERE client_id = NEW.id
      LIMIT 1;
      
      -- If no campaigner found, get the first active campaigner
      IF default_campaigner_id IS NULL THEN
        SELECT id INTO default_campaigner_id
        FROM public.campaigners
        WHERE active = true
        LIMIT 1;
      END IF;
      
      -- Create onboarding entry
      IF default_campaigner_id IS NOT NULL THEN
        INSERT INTO public.client_onboarding (
          client_id,
          agency_id,
          campaigner_id,
          title,
          status,
          notes
        ) VALUES (
          NEW.id,
          NEW.agency_id,
          default_campaigner_id,
          'קליטת לקוח: ' || NEW.name,
          'research_meeting',
          'נוצר אוטומטית מעדכון סטטוס לקוח'
        );
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to automatically handle client onboarding status
CREATE TRIGGER on_client_onboarding_status_change
AFTER INSERT OR UPDATE ON public.clients
FOR EACH ROW
EXECUTE FUNCTION public.handle_client_onboarding_status();