-- Add metadata column to invitation_tokens for storing invitation details
ALTER TABLE public.invitation_tokens
ADD COLUMN metadata jsonb DEFAULT '{}'::jsonb;