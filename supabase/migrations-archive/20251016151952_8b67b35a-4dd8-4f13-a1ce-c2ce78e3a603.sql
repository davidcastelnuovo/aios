-- Add folder_link column to clients table
ALTER TABLE public.clients 
ADD COLUMN folder_link text;

-- Add folder_link column to suppliers table
ALTER TABLE public.suppliers 
ADD COLUMN folder_link text;

-- Add folder_link column to campaigners table
ALTER TABLE public.campaigners 
ADD COLUMN folder_link text;