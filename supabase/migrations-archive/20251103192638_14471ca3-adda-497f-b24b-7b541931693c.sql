-- Add 'seo' role to the app_role enum if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'app_role' AND e.enumlabel = 'seo'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'seo';
  END IF;
END $$;