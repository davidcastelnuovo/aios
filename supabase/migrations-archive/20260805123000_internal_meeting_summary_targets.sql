-- Meeting summaries can belong to a client/lead, one or more internal team
-- members, or the agency itself. `summary_scope = auto` lets the recording
-- matcher choose a client/internal team first and fall back to the tenant's
-- default agency.

ALTER TABLE public.zoom_recordings
  ADD COLUMN IF NOT EXISTS agency_id uuid REFERENCES public.agencies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS summary_scope text;

ALTER TABLE public.zoom_recordings
  DROP CONSTRAINT IF EXISTS zoom_recordings_summary_scope_check;
ALTER TABLE public.zoom_recordings
  ADD CONSTRAINT zoom_recordings_summary_scope_check
  CHECK (summary_scope IS NULL OR summary_scope IN ('auto', 'client', 'lead', 'campaigner', 'agency'));

CREATE INDEX IF NOT EXISTS idx_zoom_recordings_agency
  ON public.zoom_recordings(tenant_id, agency_id)
  WHERE agency_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_zoom_recordings_campaigners
  ON public.zoom_recordings USING gin(campaigner_ids);

ALTER TABLE public.meeting_bot_sessions
  ADD COLUMN IF NOT EXISTS agency_id uuid REFERENCES public.agencies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS campaigner_ids uuid[],
  ADD COLUMN IF NOT EXISTS summary_scope text NOT NULL DEFAULT 'auto';

ALTER TABLE public.meeting_bot_sessions
  DROP CONSTRAINT IF EXISTS meeting_bot_sessions_summary_scope_check;
ALTER TABLE public.meeting_bot_sessions
  ADD CONSTRAINT meeting_bot_sessions_summary_scope_check
  CHECK (summary_scope IN ('auto', 'client', 'lead', 'campaigner', 'agency'));

CREATE INDEX IF NOT EXISTS idx_meeting_bot_sessions_agency
  ON public.meeting_bot_sessions(tenant_id, agency_id)
  WHERE agency_id IS NOT NULL;

COMMENT ON COLUMN public.zoom_recordings.summary_scope IS
  'Summary owner: auto/client/lead/campaigner/agency. Internal people are stored in campaigner_ids.';
COMMENT ON COLUMN public.zoom_recordings.agency_id IS
  'Agency that owns an agency-wide or internal meeting summary.';
