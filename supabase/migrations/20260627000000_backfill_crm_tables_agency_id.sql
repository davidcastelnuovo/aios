-- Reports module: the agency filter wasn't filtering because most crm_tables rows
-- had agency_id = NULL while being linked to a client that DOES belong to an agency.
-- The frontend filter keeps every NULL-agency row visible under every agency, so
-- those reports leaked into all agency views. Backfill the missing agency_id from
-- the linked client, and add a trigger so future rows stay in sync automatically.

-- 1) Backfill: align each table's agency with its linked client's agency — both
--    where it was missing (NULL) and where it drifted (table relinked to a client
--    in a different agency, leaving a stale agency_id).
UPDATE public.crm_tables t
SET agency_id = c.agency_id
FROM public.clients c
WHERE t.client_id = c.id
  AND c.agency_id IS NOT NULL
  AND t.agency_id IS DISTINCT FROM c.agency_id;

-- 2) Keep agency_id in sync going forward: a table's agency always follows its
--    linked client's agency. This covers the first link (agency_id was NULL) AND
--    relinking to a client in a different agency (e.g. LinkTableToClientDialog
--    updates only client_id) — otherwise the stale agency_id would keep the report
--    under the wrong agency and hide it from the client's real one. We only ever
--    set it to the client's existing agency, so it cannot widen scope, and we
--    leave agency_id untouched when the client has no agency (never wipe it).
CREATE OR REPLACE FUNCTION public.crm_tables_fill_agency_from_client()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agency uuid;
BEGIN
  IF NEW.client_id IS NOT NULL THEN
    SELECT c.agency_id INTO v_agency
    FROM public.clients c
    WHERE c.id = NEW.client_id;
    IF v_agency IS NOT NULL THEN
      NEW.agency_id := v_agency;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS crm_tables_fill_agency ON public.crm_tables;
CREATE TRIGGER crm_tables_fill_agency
BEFORE INSERT OR UPDATE OF client_id, agency_id ON public.crm_tables
FOR EACH ROW
EXECUTE FUNCTION public.crm_tables_fill_agency_from_client();
