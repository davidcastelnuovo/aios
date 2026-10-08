-- Fix handle_campaigner_assignment trigger to match unique constraint
CREATE OR REPLACE FUNCTION public.handle_campaigner_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_tenant_id uuid;
BEGIN
  -- Get user's tenant_id
  SELECT tenant_id INTO v_tenant_id
  FROM public.tenant_users
  WHERE user_id = NEW.id
  LIMIT 1;

  -- If campaigner_id was just set (and wasn't set before or was NULL)
  IF NEW.campaigner_id IS NOT NULL AND (OLD.campaigner_id IS NULL OR OLD.campaigner_id != NEW.campaigner_id) THEN
    -- Add campaigner role if it doesn't exist
    INSERT INTO public.user_roles (user_id, role, tenant_id)
    VALUES (NEW.id, 'campaigner', v_tenant_id)
    ON CONFLICT (user_id, role, tenant_id) DO NOTHING;
  END IF;
  
  -- If campaigner_id was removed
  IF NEW.campaigner_id IS NULL AND OLD.campaigner_id IS NOT NULL THEN
    -- Remove campaigner role (but only if user has no client_team assignments)
    IF NOT EXISTS (
      SELECT 1 FROM public.client_team 
      WHERE campaigner_id = OLD.campaigner_id
    ) THEN
      DELETE FROM public.user_roles
      WHERE user_id = NEW.id 
        AND role = 'campaigner' 
        AND tenant_id = v_tenant_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;