-- Add campaigner_id to profiles table to link users with campaigners
ALTER TABLE public.profiles
ADD COLUMN campaigner_id UUID REFERENCES public.campaigners(id) ON DELETE SET NULL;

-- Allow admins to update campaigner assignments
-- The existing update policy should handle this, but let's make sure
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own basic profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id AND 
    campaigner_id IS NULL OR campaigner_id = (SELECT campaigner_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "Admins can update all profiles"
  ON public.profiles
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));