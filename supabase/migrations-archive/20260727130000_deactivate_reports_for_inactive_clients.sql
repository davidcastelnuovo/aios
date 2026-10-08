-- A paused or ended client must not appear in campaign reporting. Keep the
-- report rows for history, but mark them inactive through the existing flag.

CREATE OR REPLACE FUNCTION public.deactivate_reports_for_inactive_client()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('paused', 'ended')
     AND NEW.status IS DISTINCT FROM OLD.status THEN
    UPDATE public.crm_tables
    SET campaign_active = false
    WHERE client_id = NEW.id
      AND campaign_active IS DISTINCT FROM false;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS deactivate_reports_for_inactive_client
  ON public.clients;

CREATE TRIGGER deactivate_reports_for_inactive_client
AFTER UPDATE OF status ON public.clients
FOR EACH ROW
EXECUTE FUNCTION public.deactivate_reports_for_inactive_client();

-- Bring existing paused/ended clients into the same state immediately.
UPDATE public.crm_tables AS report
SET campaign_active = false
FROM public.clients AS client
WHERE report.client_id = client.id
  AND client.status IN ('paused', 'ended')
  AND report.campaign_active IS DISTINCT FROM false;
