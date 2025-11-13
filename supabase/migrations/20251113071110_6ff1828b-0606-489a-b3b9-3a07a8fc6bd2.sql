-- First, drop all existing policies on profiles
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'profiles' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', r.policyname);
    END LOOP;
END $$;

-- Now create the secure RLS policies for profiles table

-- Users can view their own profile
CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

-- Users can view profiles from their tenant (tenant-scoped)
CREATE POLICY "Users can view profiles in their tenant"
ON public.profiles
FOR SELECT
USING (
  id IN (
    SELECT tu1.user_id 
    FROM tenant_users tu1
    WHERE tu1.tenant_id IN (
      SELECT tu2.tenant_id 
      FROM tenant_users tu2 
      WHERE tu2.user_id = auth.uid()
    )
  )
);

-- Super admins can view all profiles
CREATE POLICY "Super admins can view all profiles"
ON public.profiles
FOR SELECT
USING (is_super_admin(auth.uid()));

-- Users can update their own profile
CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Service role can insert profiles (for signup trigger)
CREATE POLICY "Service role can insert profiles"
ON public.profiles
FOR INSERT
WITH CHECK (true);