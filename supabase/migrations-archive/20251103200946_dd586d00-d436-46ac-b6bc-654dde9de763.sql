-- 1) Update function to set tenant_id on created onboarding rows
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

-- 2) Safety BEFORE INSERT trigger to always set tenant_id on client_onboarding
CREATE OR REPLACE FUNCTION public.set_client_onboarding_tenant_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    IF NEW.client_id IS NOT NULL THEN
      SELECT tenant_id INTO NEW.tenant_id FROM public.clients WHERE id = NEW.client_id;
    ELSIF NEW.agency_id IS NOT NULL THEN
      SELECT tenant_id INTO NEW.tenant_id FROM public.agencies WHERE id = NEW.agency_id;
    ELSE
      -- Fallback to current user's tenant if available
      SELECT public.get_user_tenant_id(auth.uid()) INTO NEW.tenant_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS set_client_onboarding_tenant_id ON public.client_onboarding;
CREATE TRIGGER set_client_onboarding_tenant_id
BEFORE INSERT ON public.client_onboarding
FOR EACH ROW
EXECUTE FUNCTION public.set_client_onboarding_tenant_id();

-- 3) Backfill missing tenant_id on existing onboarding rows
UPDATE public.client_onboarding co
SET tenant_id = c.tenant_id
FROM public.clients c
WHERE co.client_id = c.id
  AND co.tenant_id IS NULL;