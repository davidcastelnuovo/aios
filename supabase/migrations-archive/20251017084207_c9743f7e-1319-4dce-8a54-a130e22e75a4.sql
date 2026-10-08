-- Add explicit policies for admins to view all clients and tasks

-- Drop existing policy and recreate with better logic
DROP POLICY IF EXISTS "Users can view their assigned clients" ON public.clients;
DROP POLICY IF EXISTS "Owners can view all clients" ON public.clients;

-- Admins can view all clients
CREATE POLICY "Admins can view all clients" 
ON public.clients 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'));

-- Owners can view all clients
CREATE POLICY "Owners can view all clients" 
ON public.clients 
FOR SELECT 
USING (has_role(auth.uid(), 'owner'));

-- Users can view their assigned clients
CREATE POLICY "Users can view their assigned clients" 
ON public.clients 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1
    FROM client_team
    WHERE client_team.client_id = clients.id 
    AND client_team.campaigner_id = get_user_campaigner_id(auth.uid())
  )
);

-- Drop existing task view policies and recreate
DROP POLICY IF EXISTS "Users can view their assigned tasks" ON public.tasks;
DROP POLICY IF EXISTS "Owners can view all tasks" ON public.tasks;

-- Admins can view all tasks
CREATE POLICY "Admins can view all tasks" 
ON public.tasks 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'));

-- Owners can view all tasks
CREATE POLICY "Owners can view all tasks" 
ON public.tasks 
FOR SELECT 
USING (has_role(auth.uid(), 'owner'));

-- Users can view their assigned tasks
CREATE POLICY "Users can view their assigned tasks" 
ON public.tasks 
FOR SELECT 
USING (
  campaigner_id = get_user_campaigner_id(auth.uid())
);