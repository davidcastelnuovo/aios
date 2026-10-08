-- Add foreign key from client_updates.user_id to profiles.id
ALTER TABLE public.client_updates
ADD CONSTRAINT client_updates_user_id_fkey
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;