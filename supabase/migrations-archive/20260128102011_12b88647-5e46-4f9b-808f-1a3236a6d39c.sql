-- Function to handle automatic sales_person role assignment
CREATE OR REPLACE FUNCTION public.handle_sales_person_assignment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant_id uuid;
BEGIN
  -- Get user's tenant_id
  SELECT tenant_id INTO v_tenant_id
  FROM public.tenant_users
  WHERE user_id = NEW.id
  LIMIT 1;

  -- If sales_person_id was just set (and wasn't set before or was different)
  IF NEW.sales_person_id IS NOT NULL AND 
     (OLD.sales_person_id IS NULL OR OLD.sales_person_id != NEW.sales_person_id) THEN
    -- Add sales_person role if it doesn't exist
    INSERT INTO public.user_roles (user_id, role, tenant_id)
    VALUES (NEW.id, 'sales_person', v_tenant_id)
    ON CONFLICT (user_id, role, tenant_id) DO NOTHING;
  END IF;
  
  -- If sales_person_id was removed
  IF NEW.sales_person_id IS NULL AND OLD.sales_person_id IS NOT NULL THEN
    -- Remove sales_person role
    DELETE FROM public.user_roles
    WHERE user_id = NEW.id 
      AND role = 'sales_person' 
      AND tenant_id = v_tenant_id;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger on profiles table for sales_person_id changes
DROP TRIGGER IF EXISTS on_sales_person_assignment ON public.profiles;
CREATE TRIGGER on_sales_person_assignment 
  AFTER UPDATE OF sales_person_id ON public.profiles 
  FOR EACH ROW 
  EXECUTE FUNCTION handle_sales_person_assignment();