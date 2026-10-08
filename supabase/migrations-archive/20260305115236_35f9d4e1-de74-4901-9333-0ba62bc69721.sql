ALTER TABLE public.zoom_recordings 
  ADD COLUMN IF NOT EXISTS transcription text,
  ADD COLUMN IF NOT EXISTS transcription_status text,
  ADD COLUMN IF NOT EXISTS transcription_error text;