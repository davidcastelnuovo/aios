-- Serialize ManyChat lead-alert sends per destination phone so back-to-back leads
-- cannot overwrite custom fields while a previous Flow is still sending the template.

CREATE TABLE IF NOT EXISTS public.manychat_destination_send_locks (
  destination_key text PRIMARY KEY,
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_manychat_destination_send_locks_expires
  ON public.manychat_destination_send_locks (expires_at);

ALTER TABLE public.manychat_destination_send_locks ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.try_acquire_manychat_destination_lock(
  p_destination_key text,
  p_ttl_seconds integer DEFAULT 90
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $func$
DECLARE
  got_lock boolean := false;
BEGIN
  IF p_destination_key IS NULL OR length(trim(p_destination_key)) = 0 THEN
    RETURN true;
  END IF;

  DELETE FROM public.manychat_destination_send_locks
  WHERE expires_at <= now();

  INSERT INTO public.manychat_destination_send_locks (destination_key, expires_at)
  VALUES (p_destination_key, now() + make_interval(secs => greatest(p_ttl_seconds, 15)))
  ON CONFLICT (destination_key) DO NOTHING;

  GET DIAGNOSTICS got_lock = ROW_COUNT;
  RETURN got_lock;
END;
$func$;

CREATE OR REPLACE FUNCTION public.release_manychat_destination_lock(
  p_destination_key text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $func$
BEGIN
  IF p_destination_key IS NULL OR length(trim(p_destination_key)) = 0 THEN
    RETURN;
  END IF;
  DELETE FROM public.manychat_destination_send_locks
  WHERE destination_key = p_destination_key;
END;
$func$;

REVOKE ALL ON FUNCTION public.try_acquire_manychat_destination_lock(text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_manychat_destination_lock(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.try_acquire_manychat_destination_lock(text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_manychat_destination_lock(text) TO service_role;
