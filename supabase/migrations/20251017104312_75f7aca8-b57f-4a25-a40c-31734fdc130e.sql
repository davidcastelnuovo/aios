-- Remove supplier_payment column from client_suppliers table
-- This will also delete all payment data stored in this column
ALTER TABLE public.client_suppliers
DROP COLUMN IF EXISTS supplier_payment;