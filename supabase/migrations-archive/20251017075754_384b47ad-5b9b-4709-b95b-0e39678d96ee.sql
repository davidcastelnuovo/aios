-- Allow users to view their own role in user_roles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_roles' AND policyname = 'Users can view own role'
  ) THEN
    CREATE POLICY "Users can view own role"
    ON public.user_roles
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);
  END IF;
END
$$;

-- Allow owners to view all clients (in addition to existing admin/assigned policy)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'clients' AND policyname = 'Owners can view all clients'
  ) THEN
    CREATE POLICY "Owners can view all clients"
    ON public.clients
    FOR SELECT
    TO authenticated
    USING (public.has_role(auth.uid(), 'owner'::app_role));
  END IF;
END
$$;