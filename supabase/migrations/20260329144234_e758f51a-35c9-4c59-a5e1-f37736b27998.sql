
-- Create storage bucket for social media images (if not exists)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('social-media', 'social-media', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access
CREATE POLICY "Public read social-media" ON storage.objects
FOR SELECT USING (bucket_id = 'social-media');

-- Allow service role uploads
CREATE POLICY "Service role upload social-media" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'social-media');
