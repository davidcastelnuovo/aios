-- Recordings can already be linked to clients and internal campaigners. Add an
-- explicit agency target for recordings that belong to an agency but not to a
-- specific client.

ALTER TABLE public.zoom_recordings
  ADD COLUMN IF NOT EXISTS agency_id uuid
  REFERENCES public.agencies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_zoom_recordings_agency_id
  ON public.zoom_recordings(agency_id)
  WHERE agency_id IS NOT NULL;

-- Client-linked recordings inherit the client's agency for consistent display
-- and future agency filtering. Existing internal/unassigned recordings remain
-- untouched.
UPDATE public.zoom_recordings AS r
SET agency_id = c.agency_id
FROM public.clients AS c
WHERE r.client_id = c.id
  AND c.agency_id IS NOT NULL
  AND r.agency_id IS DISTINCT FROM c.agency_id;

