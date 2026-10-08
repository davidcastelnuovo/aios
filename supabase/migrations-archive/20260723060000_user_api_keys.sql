-- Personal AI API keys: any user may bring their own OpenAI key to use the
-- Carmen Command Center (voice stack bills their key, not the org's).
-- Owner-only RLS; edge functions read via service role.

CREATE TABLE IF NOT EXISTS public.user_api_keys (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'openai',
  api_key text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.user_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_api_keys_select_own" ON public.user_api_keys
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "user_api_keys_insert_own" ON public.user_api_keys
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_api_keys_update_own" ON public.user_api_keys
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_api_keys_delete_own" ON public.user_api_keys
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
