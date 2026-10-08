-- Create storage bucket for task attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('task-attachments', 'task-attachments', false);

-- Create storage policies for task attachments
CREATE POLICY "Users can upload task attachments"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'task-attachments' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view task attachments"
ON storage.objects
FOR SELECT
USING (bucket_id = 'task-attachments');

CREATE POLICY "Users can delete their own task attachments"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'task-attachments' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Add attachments column to task_updates table
ALTER TABLE task_updates
ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;