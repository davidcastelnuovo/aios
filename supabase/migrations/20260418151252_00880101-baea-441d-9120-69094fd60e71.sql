ALTER TABLE public.client_updates ADD COLUMN IF NOT EXISTS update_type TEXT;
CREATE INDEX IF NOT EXISTS idx_client_updates_update_type ON public.client_updates(update_type);
CREATE INDEX IF NOT EXISTS idx_client_updates_client_type ON public.client_updates(client_id, update_type);