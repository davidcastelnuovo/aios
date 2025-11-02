-- 1) Backfill tenant_id on existing tasks using client -> tenant, else agency -> tenant
UPDATE public.tasks t
SET tenant_id = c.tenant_id
FROM public.clients c
WHERE t.client_id = c.id AND (t.tenant_id IS NULL OR t.tenant_id <> c.tenant_id);

UPDATE public.tasks t
SET tenant_id = a.tenant_id
FROM public.agencies a
WHERE t.agency_id = a.id AND t.tenant_id IS NULL;

-- 2) Create function + trigger to always set tenant_id based on client/agency
CREATE OR REPLACE FUNCTION public.set_task_tenant_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.client_id IS NOT NULL THEN
    SELECT tenant_id INTO NEW.tenant_id FROM public.clients WHERE id = NEW.client_id;
  ELSIF NEW.agency_id IS NOT NULL THEN
    SELECT tenant_id INTO NEW.tenant_id FROM public.agencies WHERE id = NEW.agency_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_task_tenant_id ON public.tasks;
CREATE TRIGGER trg_set_task_tenant_id
BEFORE INSERT OR UPDATE OF client_id, agency_id ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.set_task_tenant_id();

-- 3) Ensure tenant_id is always present going forward
ALTER TABLE public.tasks
ALTER COLUMN tenant_id SET NOT NULL;