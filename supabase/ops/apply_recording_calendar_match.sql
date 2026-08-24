-- Ops copy of 20260824080000_recording_calendar_match.sql.

ALTER TABLE public.zoom_recordings
  ADD COLUMN IF NOT EXISTS calendar_event_id text,
  ADD COLUMN IF NOT EXISTS calendar_matched_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_zoom_recordings_calendar_event
  ON public.zoom_recordings(tenant_id, calendar_event_id)
  WHERE calendar_event_id IS NOT NULL;

COMMENT ON COLUMN public.zoom_recordings.calendar_event_id IS
  'Google Calendar event used to name and optionally assign this recording.';
COMMENT ON COLUMN public.zoom_recordings.calendar_matched_at IS
  'When deterministic calendar/time matching was applied.';
