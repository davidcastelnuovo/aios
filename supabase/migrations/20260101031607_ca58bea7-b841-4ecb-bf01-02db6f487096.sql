-- Add 'not_progressing' value to client_mood_status enum
ALTER TYPE public.client_mood_status ADD VALUE IF NOT EXISTS 'not_progressing';