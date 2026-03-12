CREATE OR REPLACE FUNCTION public.set_task_tenant_id()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    IF NEW.client_id IS NOT NULL THEN
      SELECT tenant_id INTO NEW.tenant_id FROM public.clients WHERE id = NEW.client_id;
    ELSIF NEW.agency_id IS NOT NULL THEN
      SELECT tenant_id INTO NEW.tenant_id FROM public.agencies WHERE id = NEW.agency_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;