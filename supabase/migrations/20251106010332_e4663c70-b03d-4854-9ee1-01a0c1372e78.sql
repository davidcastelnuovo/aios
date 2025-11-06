-- Create/refresh triggers to auto-set tenant_id on insert/update (when missing)
-- Agencies
DROP TRIGGER IF EXISTS set_agency_tenant_id_before_insert ON public.agencies;
DROP TRIGGER IF EXISTS set_agency_tenant_id_before_update ON public.agencies;
CREATE TRIGGER set_agency_tenant_id_before_insert
BEFORE INSERT ON public.agencies
FOR EACH ROW
EXECUTE FUNCTION public.set_agency_tenant_id();
CREATE TRIGGER set_agency_tenant_id_before_update
BEFORE UPDATE ON public.agencies
FOR EACH ROW WHEN (NEW.tenant_id IS NULL)
EXECUTE FUNCTION public.set_agency_tenant_id();

-- Clients
DROP TRIGGER IF EXISTS set_client_tenant_id_before_insert ON public.clients;
DROP TRIGGER IF EXISTS set_client_tenant_id_before_update ON public.clients;
CREATE TRIGGER set_client_tenant_id_before_insert
BEFORE INSERT ON public.clients
FOR EACH ROW
EXECUTE FUNCTION public.set_client_tenant_id();
CREATE TRIGGER set_client_tenant_id_before_update
BEFORE UPDATE ON public.clients
FOR EACH ROW WHEN (NEW.tenant_id IS NULL)
EXECUTE FUNCTION public.set_client_tenant_id();

-- Leads
DROP TRIGGER IF EXISTS set_lead_tenant_id_before_insert ON public.leads;
DROP TRIGGER IF EXISTS set_lead_tenant_id_before_update ON public.leads;
CREATE TRIGGER set_lead_tenant_id_before_insert
BEFORE INSERT ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.set_lead_tenant_id();
CREATE TRIGGER set_lead_tenant_id_before_update
BEFORE UPDATE ON public.leads
FOR EACH ROW WHEN (NEW.tenant_id IS NULL)
EXECUTE FUNCTION public.set_lead_tenant_id();

-- Products
DROP TRIGGER IF EXISTS set_product_tenant_id_before_insert ON public.products;
DROP TRIGGER IF EXISTS set_product_tenant_id_before_update ON public.products;
CREATE TRIGGER set_product_tenant_id_before_insert
BEFORE INSERT ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.set_product_tenant_id();
CREATE TRIGGER set_product_tenant_id_before_update
BEFORE UPDATE ON public.products
FOR EACH ROW WHEN (NEW.tenant_id IS NULL)
EXECUTE FUNCTION public.set_product_tenant_id();

-- Tasks
DROP TRIGGER IF EXISTS set_task_tenant_id_before_insert ON public.tasks;
DROP TRIGGER IF EXISTS set_task_tenant_id_before_update ON public.tasks;
CREATE TRIGGER set_task_tenant_id_before_insert
BEFORE INSERT ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.set_task_tenant_id();
CREATE TRIGGER set_task_tenant_id_before_update
BEFORE UPDATE ON public.tasks
FOR EACH ROW WHEN (NEW.tenant_id IS NULL)
EXECUTE FUNCTION public.set_task_tenant_id();

-- Campaigners
DROP TRIGGER IF EXISTS set_campaigner_tenant_id_before_insert ON public.campaigners;
DROP TRIGGER IF EXISTS set_campaigner_tenant_id_before_update ON public.campaigners;
CREATE TRIGGER set_campaigner_tenant_id_before_insert
BEFORE INSERT ON public.campaigners
FOR EACH ROW
EXECUTE FUNCTION public.set_campaigner_tenant_id();
CREATE TRIGGER set_campaigner_tenant_id_before_update
BEFORE UPDATE ON public.campaigners
FOR EACH ROW WHEN (NEW.tenant_id IS NULL)
EXECUTE FUNCTION public.set_campaigner_tenant_id();

-- Client Onboarding
DROP TRIGGER IF EXISTS set_client_onboarding_tenant_id_before_insert ON public.client_onboarding;
DROP TRIGGER IF EXISTS set_client_onboarding_tenant_id_before_update ON public.client_onboarding;
CREATE TRIGGER set_client_onboarding_tenant_id_before_insert
BEFORE INSERT ON public.client_onboarding
FOR EACH ROW
EXECUTE FUNCTION public.set_client_onboarding_tenant_id();
CREATE TRIGGER set_client_onboarding_tenant_id_before_update
BEFORE UPDATE ON public.client_onboarding
FOR EACH ROW WHEN (NEW.tenant_id IS NULL)
EXECUTE FUNCTION public.set_client_onboarding_tenant_id();