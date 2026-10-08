-- Multi-part transcription audio: long extension recordings are segmented into
-- self-contained ~1h opus files so each part stays under Whisper's 25MB cap.
ALTER TABLE public.zoom_recordings ADD COLUMN IF NOT EXISTS audio_file_paths text[];

COMMENT ON COLUMN public.zoom_recordings.audio_file_paths IS
  'Ordered transcription audio segments (each a standalone file under the Whisper 25MB cap); when set, transcribe-recording transcribes each and concatenates';
