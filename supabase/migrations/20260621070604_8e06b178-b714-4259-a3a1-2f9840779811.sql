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
  IF (NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('closed','ended','expired'))
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