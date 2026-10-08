-- 1. Create function to get user's campaigner_id
CREATE OR REPLACE FUNCTION public.get_user_campaigner_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT campaigner_id
  FROM public.profiles
  WHERE id = _user_id
$$;

-- 2. Update tasks RLS policies to use campaigner relationship
DROP POLICY IF EXISTS "Users can view their assigned tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can insert their own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can update their assigned tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can delete their assigned tasks" ON public.tasks;

CREATE POLICY "Users can view their assigned tasks"
ON public.tasks
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'owner'::app_role)
  OR (campaigner_id = public.get_user_campaigner_id(auth.uid()))
);

CREATE POLICY "Users can insert their own tasks"
ON public.tasks
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'owner'::app_role)
  OR (campaigner_id = public.get_user_campaigner_id(auth.uid()))
);

CREATE POLICY "Users can update their assigned tasks"
ON public.tasks
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'owner'::app_role)
  OR (campaigner_id = public.get_user_campaigner_id(auth.uid()))
);

CREATE POLICY "Users can delete their assigned tasks"
ON public.tasks
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'owner'::app_role)
  OR (campaigner_id = public.get_user_campaigner_id(auth.uid()))
);

-- 3. Update clients RLS policies to use campaigner relationship
DROP POLICY IF EXISTS "Users can view their assigned clients" ON public.clients;
DROP POLICY IF EXISTS "Users can update their assigned clients" ON public.clients;

CREATE POLICY "Users can view their assigned clients"
ON public.clients
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'owner'::app_role)
  OR EXISTS (
    SELECT 1
    FROM client_team
    WHERE client_team.client_id = clients.id
    AND client_team.campaigner_id = public.get_user_campaigner_id(auth.uid())
  )
);

CREATE POLICY "Users can update their assigned clients"
ON public.clients
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'owner'::app_role)
  OR EXISTS (
    SELECT 1
    FROM client_team
    WHERE client_team.client_id = clients.id
    AND client_team.campaigner_id = public.get_user_campaigner_id(auth.uid())
  )
);