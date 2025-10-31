-- Add is_seo_client column to clients table
ALTER TABLE public.clients 
  ADD COLUMN is_seo_client boolean DEFAULT false;