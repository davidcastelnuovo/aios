-- AI auto-assignment (suggest-first): the pipeline may PROPOSE a client match
-- (suggested_client_id, confirmed by a human in the feed) and auto-assigns
-- only on high-confidence matches. Internal meetings get tagged with the
-- campaigners who participated.
ALTER TABLE public.zoom_recordings
  ADD COLUMN IF NOT EXISTS suggested_client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;
ALTER TABLE public.zoom_recordings ADD COLUMN IF NOT EXISTS campaigner_ids uuid[];
