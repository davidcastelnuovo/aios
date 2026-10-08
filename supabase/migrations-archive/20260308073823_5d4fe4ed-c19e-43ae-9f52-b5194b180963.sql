
-- Create ai_memory table for persistent AI agent memory
CREATE TABLE public.ai_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'general',
  key text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, tenant_id, category, key)
);

-- Enable RLS
ALTER TABLE public.ai_memory ENABLE ROW LEVEL SECURITY;

-- Users can only see their own memory
CREATE POLICY "Users can view own memory"
ON public.ai_memory FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert own memory"
ON public.ai_memory FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own memory"
ON public.ai_memory FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own memory"
ON public.ai_memory FOR DELETE
TO authenticated
USING (user_id = auth.uid());
