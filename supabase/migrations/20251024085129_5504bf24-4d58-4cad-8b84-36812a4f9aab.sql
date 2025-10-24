-- Add sales_person_id column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN sales_person_id uuid REFERENCES public.sales_people(id) ON DELETE SET NULL;