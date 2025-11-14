-- Create a function to initialize menu items for all existing tenants
CREATE OR REPLACE FUNCTION public.initialize_all_tenants_menu_items()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN SELECT id FROM public.tenants LOOP
    PERFORM public.initialize_tenant_menu_items(t.id);
  END LOOP;
END;
$$;

-- Ensure new tenants automatically get menu items
DROP TRIGGER IF EXISTS trg_handle_new_tenant_menu_items ON public.tenants;
CREATE TRIGGER trg_handle_new_tenant_menu_items
AFTER INSERT ON public.tenants
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_tenant_menu_items();

-- Run backfill now for all existing tenants
SELECT public.initialize_all_tenants_menu_items();