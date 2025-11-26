-- Fix get_effective_tenant_id to use active tenant logic
CREATE OR REPLACE FUNCTION public.get_effective_tenant_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT tenant_id FROM public.user_active_tenant WHERE user_id = auth.uid() LIMIT 1),
    (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid() LIMIT 1)
  );
$function$;

-- Update SELECT policy for tasks to use effective tenant
DROP POLICY IF EXISTS "Users can view tasks from accessible agencies" ON tasks;

CREATE POLICY "Users can view tasks from accessible agencies"
ON tasks FOR SELECT
USING (
  is_super_admin(auth.uid())
  OR
  tenant_id = get_effective_tenant_id()
);

-- Update UPDATE policy for tasks to use effective tenant
DROP POLICY IF EXISTS "Users can update tasks in accessible agencies" ON tasks;

CREATE POLICY "Users can update tasks in accessible agencies"
ON tasks FOR UPDATE
USING (
  is_super_admin(auth.uid())
  OR
  tenant_id = get_effective_tenant_id()
)
WITH CHECK (
  is_super_admin(auth.uid())
  OR
  tenant_id = get_effective_tenant_id()
);