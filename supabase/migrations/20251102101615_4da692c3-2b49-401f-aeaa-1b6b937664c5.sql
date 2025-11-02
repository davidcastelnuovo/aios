-- Make client_id nullable in tasks table to allow general tasks
ALTER TABLE public.tasks ALTER COLUMN client_id DROP NOT NULL;