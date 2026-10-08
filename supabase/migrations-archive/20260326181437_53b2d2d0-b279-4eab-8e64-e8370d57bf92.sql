
-- Trigger function: when client status changes, sync to client_onboarding
CREATE OR REPLACE FUNCTION public.sync_client_status_to_onboarding()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- When client becomes active, set all non-campaign_live onboarding entries to campaign_live
  IF NEW.status = 'active' AND (OLD.status IS NULL OR OLD.status != 'active') THEN
    UPDATE public.client_onboarding
    SET status = 'campaign_live', updated_at = now()
    WHERE client_id = NEW.id
      AND status != 'campaign_live';
  END IF;

  -- When client goes back to onboarding from active/paused/ended, 
  -- reset campaign_live onboarding entries to receiving_access
  IF NEW.status = 'onboarding' AND OLD.status != 'onboarding' THEN
    UPDATE public.client_onboarding
    SET status = 'receiving_access', updated_at = now()
    WHERE client_id = NEW.id
      AND status = 'campaign_live';
  END IF;

  -- When client is paused or ended, also mark onboarding as campaign_live
  -- (they completed onboarding even if paused/ended)
  IF NEW.status IN ('paused', 'ended') AND OLD.status = 'onboarding' THEN
    UPDATE public.client_onboarding
    SET status = 'campaign_live', updated_at = now()
    WHERE client_id = NEW.id
      AND status != 'campaign_live';
  END IF;

  RETURN NEW;
END;
$$;

-- Create the trigger on clients table
DROP TRIGGER IF EXISTS trigger_sync_client_status_to_onboarding ON public.clients;
CREATE TRIGGER trigger_sync_client_status_to_onboarding
  AFTER UPDATE OF status ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_client_status_to_onboarding();
