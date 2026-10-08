ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS is_ecommerce boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.clients.is_ecommerce IS 'Marks client as ecommerce — Carmen returns purchase metrics (revenue, CPP, ROAS, profit) instead of CPL in pulse checks.';
CREATE INDEX IF NOT EXISTS idx_clients_is_ecommerce ON public.clients(tenant_id, is_ecommerce) WHERE is_ecommerce = true;