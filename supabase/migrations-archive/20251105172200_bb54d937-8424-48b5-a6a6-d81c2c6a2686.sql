-- Ensure tenant_id is automatically set on insert for all relevant tables

-- Clients: set tenant_id from agency
CREATE OR REPLACE FUNCTION public.set_client_tenant_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    SELECT tenant_id INTO NEW.tenant_id 
    FROM public.agencies 
    WHERE id = NEW.agency_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_client_tenant_id_trigger ON public.clients;
CREATE TRIGGER set_client_tenant_id_trigger
  BEFORE INSERT ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.set_client_tenant_id();

-- Leads: set tenant_id from agency
CREATE OR REPLACE FUNCTION public.set_lead_tenant_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    IF NEW.agency_id IS NOT NULL THEN
      SELECT tenant_id INTO NEW.tenant_id 
      FROM public.agencies 
      WHERE id = NEW.agency_id;
    ELSE
      -- Fallback: get user's tenant
      SELECT tenant_id INTO NEW.tenant_id
      FROM public.tenant_users
      WHERE user_id = auth.uid()
      LIMIT 1;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_lead_tenant_id_trigger ON public.leads;
CREATE TRIGGER set_lead_tenant_id_trigger
  BEFORE INSERT ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.set_lead_tenant_id();

-- Products: set tenant_id from user
CREATE OR REPLACE FUNCTION public.set_product_tenant_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    SELECT tenant_id INTO NEW.tenant_id
    FROM public.tenant_users
    WHERE user_id = auth.uid()
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_product_tenant_id_trigger ON public.products;
CREATE TRIGGER set_product_tenant_id_trigger
  BEFORE INSERT ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.set_product_tenant_id();

COMMENT ON FUNCTION public.set_client_tenant_id() IS 'Automatically sets tenant_id for new clients based on their agency';
COMMENT ON FUNCTION public.set_lead_tenant_id() IS 'Automatically sets tenant_id for new leads based on their agency or user';
COMMENT ON FUNCTION public.set_product_tenant_id() IS 'Automatically sets tenant_id for new products based on the current user';