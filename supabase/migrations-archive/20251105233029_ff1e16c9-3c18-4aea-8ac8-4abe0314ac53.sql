-- Update handle_new_user function to set status as 'active' by default
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create a profile with 'active' status (will be set to 'pending' by invitation system if needed)
  INSERT INTO public.profiles (id, email, full_name, status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'active'  -- Default to active
  );
  
  RETURN NEW;
END;
$$;