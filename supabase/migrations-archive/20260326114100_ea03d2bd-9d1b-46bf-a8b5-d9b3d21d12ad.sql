
ALTER TABLE public.ai_detection_prompts
  ADD COLUMN IF NOT EXISTS created_by uuid;
