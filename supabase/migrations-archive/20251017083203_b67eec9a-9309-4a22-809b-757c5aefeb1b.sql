-- Allow owners to manage roles like admins
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_roles' AND policyname='Owners can view all roles'
  ) THEN
    CREATE POLICY "Owners can view all roles"
    ON public.user_roles
    FOR SELECT
    TO authenticated
    USING (public.has_role(auth.uid(), 'owner'::app_role));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_roles' AND policyname='Owners can insert roles'
  ) THEN
    CREATE POLICY "Owners can insert roles"
    ON public.user_roles
    FOR INSERT
    TO authenticated
    WITH CHECK (public.has_role(auth.uid(), 'owner'::app_role));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_roles' AND policyname='Owners can update roles'
  ) THEN
    CREATE POLICY "Owners can update roles"
    ON public.user_roles
    FOR UPDATE
    TO authenticated
    USING (public.has_role(auth.uid(), 'owner'::app_role));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_roles' AND policyname='Owners can delete roles'
  ) THEN
    CREATE POLICY "Owners can delete roles"
    ON public.user_roles
    FOR DELETE
    TO authenticated
    USING (public.has_role(auth.uid(), 'owner'::app_role));
  END IF;
END $$;

-- Allow owners to update all profiles (like admins)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='Owners can update all profiles'
  ) THEN
    CREATE POLICY "Owners can update all profiles"
    ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (public.has_role(auth.uid(), 'owner'::app_role));
  END IF;
END $$;