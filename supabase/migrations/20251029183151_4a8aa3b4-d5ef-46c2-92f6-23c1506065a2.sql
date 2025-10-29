-- Add foreign key from task_updates.user_id to profiles.id
ALTER TABLE public.task_updates
ADD CONSTRAINT task_updates_user_id_fkey
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;