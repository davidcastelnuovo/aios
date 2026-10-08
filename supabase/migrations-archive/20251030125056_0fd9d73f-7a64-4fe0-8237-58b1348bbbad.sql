-- Create trigger function to auto-assign campaigner role when campaigner_id is set
CREATE OR REPLACE FUNCTION public.handle_campaigner_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- If campaigner_id was just set (and wasn't set before or was NULL)
  IF NEW.campaigner_id IS NOT NULL AND (OLD.campaigner_id IS NULL OR OLD.campaigner_id != NEW.campaigner_id) THEN
    -- Add campaigner role if it doesn't exist
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'campaigner')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  
  -- If campaigner_id was removed
  IF NEW.campaigner_id IS NULL AND OLD.campaigner_id IS NOT NULL THEN
    -- Remove campaigner role (but only if user has no client_team assignments)
    IF NOT EXISTS (
      SELECT 1 FROM public.client_team 
      WHERE campaigner_id = OLD.campaigner_id
    ) THEN
      DELETE FROM public.user_roles
      WHERE user_id = NEW.id AND role = 'campaigner';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on profiles table
CREATE TRIGGER on_campaigner_assignment
  AFTER UPDATE OF campaigner_id ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_campaigner_assignment();