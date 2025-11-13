-- Create trigger to initialize menu items for new tenants
CREATE OR REPLACE FUNCTION public.handle_new_tenant_menu_items()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Initialize menu items for the new tenant
  PERFORM initialize_tenant_menu_items(NEW.id);
  RETURN NEW;
END;
$$;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS trigger_new_tenant_menu_items ON tenants;

-- Create trigger on tenants table
CREATE TRIGGER trigger_new_tenant_menu_items
AFTER INSERT ON tenants
FOR EACH ROW
EXECUTE FUNCTION handle_new_tenant_menu_items();