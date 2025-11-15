-- Update get_user_tenant_id to prioritize user_active_tenant
CREATE OR REPLACE FUNCTION public.get_user_tenant_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT tenant_id FROM public.user_active_tenant WHERE user_id = _user_id LIMIT 1),
    (SELECT tenant_id FROM public.tenant_users WHERE user_id = _user_id LIMIT 1)
  );
$function$;