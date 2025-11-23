-- Add missing trigger for campaigners table to auto-set tenant_id
CREATE TRIGGER set_campaigner_tenant_id_trigger
  BEFORE INSERT ON public.campaigners
  FOR EACH ROW
  EXECUTE FUNCTION public.set_campaigner_tenant_id();