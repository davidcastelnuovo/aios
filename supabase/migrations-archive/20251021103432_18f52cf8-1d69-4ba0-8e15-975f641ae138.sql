-- Add agency_manager role to app_role enum
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'agency_manager';

-- Create user_managed_agencies table to link users with agencies they manage
CREATE TABLE IF NOT EXISTS public.user_managed_agencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, agency_id)
);

-- Enable RLS
ALTER TABLE public.user_managed_agencies ENABLE ROW LEVEL SECURITY;

-- Policies for user_managed_agencies
CREATE POLICY "Admins can view all user_managed_agencies"
  ON public.user_managed_agencies
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Admins can insert user_managed_agencies"
  ON public.user_managed_agencies
  FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Admins can delete user_managed_agencies"
  ON public.user_managed_agencies
  FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Users can view their own managed agencies"
  ON public.user_managed_agencies
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Update has_role function to handle agency_manager properly
CREATE OR REPLACE FUNCTION public.user_manages_agency(_user_id uuid, _agency_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_managed_agencies
    WHERE user_id = _user_id AND agency_id = _agency_id
  )
$$;