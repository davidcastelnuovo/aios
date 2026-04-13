UPDATE zoom_recordings 
SET transcription_status = 'failed', 
    transcription_error = 'Edge function timed out - please retry'
WHERE transcription_status = 'processing' 
AND updated_at < NOW() - INTERVAL '10 minutes';