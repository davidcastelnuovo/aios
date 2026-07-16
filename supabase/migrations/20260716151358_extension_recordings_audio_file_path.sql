-- Chrome extension screen recordings: low-bitrate audio-only sibling of file_path,
-- used for Whisper transcription (keeps long meetings under the 25MB/request cap).
ALTER TABLE public.zoom_recordings ADD COLUMN IF NOT EXISTS audio_file_path text;

COMMENT ON COLUMN public.zoom_recordings.audio_file_path IS
  'Low-bitrate audio-only sibling of file_path, used for transcription (chrome_extension source)';
