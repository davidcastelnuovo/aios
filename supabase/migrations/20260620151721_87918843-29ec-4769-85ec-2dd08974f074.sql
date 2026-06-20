CREATE OR REPLACE FUNCTION public.trigger_carmen_learn_from_session()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  fn_url text := 'https://jnzguisakdtcollxmgzd.supabase.co/functions/v1/carmen-learn-from-session';
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impuemd1aXNha2R0Y29sbHhtZ3pkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1NTcxNTcsImV4cCI6MjA3NjEzMzE1N30.VrxuppQtj-cByA2ml2krzwoM1rHwelXIr0f5D3eP4KM';
BEGIN
  IF (NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('closed','ended'))
     OR (NEW.ended_at IS NOT NULL AND OLD.ended_at IS NULL) THEN
    PERFORM net.http_post(
      url := fn_url,
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'Authorization','Bearer ' || anon_key,
        'apikey', anon_key
      ),
      body := jsonb_build_object('session_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS carmen_session_close_learn ON public.carmen_whatsapp_sessions;
CREATE TRIGGER carmen_session_close_learn
AFTER UPDATE ON public.carmen_whatsapp_sessions
FOR EACH ROW
EXECUTE FUNCTION public.trigger_carmen_learn_from_session();

-- Add session_ref to memory_episodes for idempotency lookup (if not exists)
ALTER TABLE public.carmen_memory_episodes
  ADD COLUMN IF NOT EXISTS session_ref uuid;

CREATE INDEX IF NOT EXISTS idx_carmen_episodes_session_ref
  ON public.carmen_memory_episodes(tenant_id, session_ref)
  WHERE session_ref IS NOT NULL;