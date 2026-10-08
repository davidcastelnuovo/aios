-- Update RLS policies for clients table
-- Users can only see clients they are assigned to via client_team
DROP POLICY IF EXISTS "Authenticated users can view clients" ON public.clients;

CREATE POLICY "Users can view their assigned clients"
  ON public.clients
  FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin') OR
    EXISTS (
      SELECT 1 FROM public.client_team
      WHERE client_team.client_id = clients.id
      AND client_team.campaigner_id IN (
        SELECT id FROM public.profiles WHERE id = auth.uid()
      )
    )
  );

-- Update RLS policies for tasks table
-- Users can only see tasks assigned to them
DROP POLICY IF EXISTS "Authenticated users can view tasks" ON public.tasks;

CREATE POLICY "Users can view their assigned tasks"
  ON public.tasks
  FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin') OR
    campaigner_id = auth.uid()
  );

-- Allow users to insert/update/delete only their own tasks
DROP POLICY IF EXISTS "Authenticated users can insert tasks" ON public.tasks;
DROP POLICY IF EXISTS "Authenticated users can update tasks" ON public.tasks;
DROP POLICY IF EXISTS "Authenticated users can delete tasks" ON public.tasks;

CREATE POLICY "Users can insert their own tasks"
  ON public.tasks
  FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    campaigner_id = auth.uid()
  );

CREATE POLICY "Users can update their assigned tasks"
  ON public.tasks
  FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'admin') OR
    campaigner_id = auth.uid()
  );

CREATE POLICY "Users can delete their assigned tasks"
  ON public.tasks
  FOR DELETE
  USING (
    public.has_role(auth.uid(), 'admin') OR
    campaigner_id = auth.uid()
  );

-- Allow users to update/delete only their assigned clients
DROP POLICY IF EXISTS "Authenticated users can insert clients" ON public.clients;
DROP POLICY IF EXISTS "Authenticated users can update clients" ON public.clients;
DROP POLICY IF EXISTS "Authenticated users can delete clients" ON public.clients;

CREATE POLICY "Admins can insert clients"
  ON public.clients
  FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can update their assigned clients"
  ON public.clients
  FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'admin') OR
    EXISTS (
      SELECT 1 FROM public.client_team
      WHERE client_team.client_id = clients.id
      AND client_team.campaigner_id = auth.uid()
    )
  );

CREATE POLICY "Admins can delete clients"
  ON public.clients
  FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));