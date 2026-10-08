-- Remove the single payment column
ALTER TABLE public.suppliers DROP COLUMN IF EXISTS payment;

-- Add three payment columns with their associated agencies
ALTER TABLE public.suppliers 
  ADD COLUMN payment_1 numeric,
  ADD COLUMN agency_id_1 uuid REFERENCES public.agencies(id),
  ADD COLUMN payment_2 numeric,
  ADD COLUMN agency_id_2 uuid REFERENCES public.agencies(id),
  ADD COLUMN payment_3 numeric,
  ADD COLUMN agency_id_3 uuid REFERENCES public.agencies(id);