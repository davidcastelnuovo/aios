-- Add retainer column to clients and backfill from existing monthly_budget values
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS retainer numeric;

-- Backfill retainer from monthly_budget where applicable
UPDATE public.clients
SET retainer = monthly_budget
WHERE retainer IS NULL AND monthly_budget IS NOT NULL;