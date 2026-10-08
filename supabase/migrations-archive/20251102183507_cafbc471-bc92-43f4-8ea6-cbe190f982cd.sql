-- Add status column to profiles table
ALTER TABLE public.profiles
ADD COLUMN status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'inactive'));

-- Add index for better query performance
CREATE INDEX idx_profiles_status ON public.profiles(status);

-- Update existing profiles to 'active' status
UPDATE public.profiles
SET status = 'active'
WHERE status = 'pending';