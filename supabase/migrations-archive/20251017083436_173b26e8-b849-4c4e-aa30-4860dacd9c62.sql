-- Allow owners to delete profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='Owners can delete profiles'
  ) THEN
    CREATE POLICY "Owners can delete profiles"
    ON public.profiles
    FOR DELETE
    TO authenticated
    USING (public.has_role(auth.uid(), 'owner'::app_role));
  END IF;
END $$;

-- Allow admins to delete profiles as well
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='Admins can delete profiles'
  ) THEN
    CREATE POLICY "Admins can delete profiles"
    ON public.profiles
    FOR DELETE
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;