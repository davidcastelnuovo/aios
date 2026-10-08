
-- Add unique constraint on zoom_recordings for upsert (tenant_id + meeting_id + recording_type)
CREATE UNIQUE INDEX IF NOT EXISTS zoom_recordings_tenant_meeting_type_unique 
ON public.zoom_recordings (tenant_id, meeting_id, recording_type);
