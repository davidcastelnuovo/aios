
-- Add source and file_path columns to zoom_recordings
ALTER TABLE public.zoom_recordings 
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'zoom',
  ADD COLUMN IF NOT EXISTS file_path text;

-- Create storage bucket for recordings
INSERT INTO storage.buckets (id, name, public)
VALUES ('recordings', 'recordings', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for recordings bucket
CREATE POLICY "Authenticated users can upload recordings"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'recordings');

CREATE POLICY "Authenticated users can view recordings"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'recordings');

CREATE POLICY "Authenticated users can delete own recordings"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'recordings');
