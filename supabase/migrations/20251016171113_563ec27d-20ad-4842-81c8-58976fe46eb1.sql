-- Backfill retainer from numeric values mistakenly stored in industry
UPDATE public.clients
SET retainer = NULLIF(industry, '')::numeric
WHERE retainer IS NULL
  AND industry ~ '^[0-9]+(\.[0-9]+)?$';