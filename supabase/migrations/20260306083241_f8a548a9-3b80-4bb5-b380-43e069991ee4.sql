
-- Add attachments column to team_messages
ALTER TABLE public.team_messages ADD COLUMN IF NOT EXISTS attachments jsonb DEFAULT '[]'::jsonb;

-- Create storage bucket for team chat files
INSERT INTO storage.buckets (id, name, public)
VALUES ('team-chat-files', 'team-chat-files', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policy: authenticated users can upload to team-chat-files
CREATE POLICY "Authenticated users can upload team chat files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'team-chat-files');

-- RLS policy: anyone can read team chat files (public bucket)
CREATE POLICY "Anyone can read team chat files"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'team-chat-files');

-- RLS policy: users can delete their own uploads
CREATE POLICY "Users can delete own team chat files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'team-chat-files' AND (storage.foldername(name))[1] = auth.uid()::text);
