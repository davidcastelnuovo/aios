-- Add foreign key to lead_updates.user_id -> profiles.id
-- This will allow Supabase to properly join with profiles table and display user info
ALTER TABLE public.lead_updates
ADD CONSTRAINT lead_updates_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES public.profiles(id) 
ON DELETE CASCADE;