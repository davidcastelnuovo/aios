-- Secure calendar_tokens with RLS and per-user policies
-- Enable Row Level Security
ALTER TABLE IF EXISTS public.calendar_tokens ENABLE ROW LEVEL SECURITY;

-- Create policies idempotently
DO $$
BEGIN
  -- SELECT
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'calendar_tokens'
      AND policyname = 'Users can read their own calendar token'
  ) THEN
    CREATE POLICY "Users can read their own calendar token"
    ON public.calendar_tokens
    FOR SELECT
    USING (auth.uid() = user_id);
  END IF;

  -- INSERT
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'calendar_tokens'
      AND policyname = 'Users can insert their own calendar token'
  ) THEN
    CREATE POLICY "Users can insert their own calendar token"
    ON public.calendar_tokens
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);
  END IF;

  -- UPDATE
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'calendar_tokens'
      AND policyname = 'Users can update their own calendar token'
  ) THEN
    CREATE POLICY "Users can update their own calendar token"
    ON public.calendar_tokens
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
  END IF;

  -- DELETE
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'calendar_tokens'
      AND policyname = 'Users can delete their own calendar token'
  ) THEN
    CREATE POLICY "Users can delete their own calendar token"
    ON public.calendar_tokens
    FOR DELETE
    USING (auth.uid() = user_id);
  END IF;
END
$$;