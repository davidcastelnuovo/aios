-- Connection-pressure snapshot + idle-connection relief + alert/scale claim locks.
-- Used by db-capacity-guard (every 2 min) and carmen-health-probe (history row).

CREATE TABLE IF NOT EXISTS public.db_capacity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level text NOT NULL,
  action text NOT NULL,
  used integer,
  max integer,
  used_pct numeric,
  detail jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_db_capacity_events_time
  ON public.db_capacity_events (created_at DESC);

ALTER TABLE public.db_capacity_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "db_capacity_events_read" ON public.db_capacity_events;
CREATE POLICY "db_capacity_events_read"
  ON public.db_capacity_events FOR SELECT
  TO authenticated
  USING (true);

CREATE TABLE IF NOT EXISTS public.db_capacity_alert_state (
  key text PRIMARY KEY,
  last_claimed_at timestamptz
);

ALTER TABLE public.db_capacity_alert_state ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.db_connection_pressure()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  max_conn integer;
  reserved integer;
  used integer;
  active integer;
  idle integer;
  idle_xact integer;
  waiting integer;
  oldest_idle numeric;
BEGIN
  SELECT setting::integer INTO max_conn FROM pg_catalog.pg_settings WHERE name = 'max_connections';
  SELECT setting::integer INTO reserved FROM pg_catalog.pg_settings WHERE name = 'superuser_reserved_connections';

  SELECT count(*) INTO used FROM pg_catalog.pg_stat_activity;
  SELECT count(*) INTO active FROM pg_catalog.pg_stat_activity WHERE state = 'active';
  SELECT count(*) INTO idle FROM pg_catalog.pg_stat_activity WHERE state = 'idle';
  SELECT count(*) INTO idle_xact FROM pg_catalog.pg_stat_activity WHERE state = 'idle in transaction';
  SELECT count(*) INTO waiting
    FROM pg_catalog.pg_stat_activity
    WHERE wait_event_type IS NOT NULL AND state = 'active';
  SELECT EXTRACT(EPOCH FROM (now() - min(state_change)))
    INTO oldest_idle
    FROM pg_catalog.pg_stat_activity
    WHERE state IN ('idle', 'idle in transaction');

  RETURN jsonb_build_object(
    'used', used,
    'max', max_conn,
    'usable', GREATEST(max_conn - COALESCE(reserved, 0), 0),
    'reserved', COALESCE(reserved, 0),
    'used_pct', CASE WHEN COALESCE(max_conn, 0) > 0
      THEN round((used::numeric / max_conn) * 100, 1)
      ELSE 0 END,
    'active', active,
    'idle', idle,
    'idle_in_transaction', idle_xact,
    'waiting', COALESCE(waiting, 0),
    'oldest_idle_seconds', round(COALESCE(oldest_idle, 0)::numeric, 1)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.db_connection_pressure() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.db_connection_pressure() TO service_role;

CREATE OR REPLACE FUNCTION public.relieve_db_connection_pressure(
  p_idle_seconds integer DEFAULT 30,
  p_max_kill integer DEFAULT 20
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  killed integer := 0;
  rec record;
  idle_cutoff interval;
  xact_cutoff interval;
BEGIN
  idle_cutoff := make_interval(secs => GREATEST(COALESCE(p_idle_seconds, 30), 10));
  xact_cutoff := make_interval(secs => GREATEST(LEAST(COALESCE(p_idle_seconds, 30), 15), 5));

  FOR rec IN
    SELECT pid, state, usename, application_name,
           EXTRACT(EPOCH FROM (now() - state_change)) AS idle_for
    FROM pg_catalog.pg_stat_activity
    WHERE pid <> pg_backend_pid()
      AND backend_type = 'client backend'
      AND COALESCE(usename, '') NOT IN (
        'supabase_admin',
        'supabase_auth_admin',
        'supabase_storage_admin',
        'supabase_functions_admin',
        'authenticator'
      )
      AND COALESCE(application_name, '') NOT ILIKE '%pg_cron%'
      AND (
        (state = 'idle' AND state_change < now() - idle_cutoff)
        OR (state = 'idle in transaction' AND state_change < now() - xact_cutoff)
      )
    ORDER BY state_change ASC
    LIMIT GREATEST(COALESCE(p_max_kill, 20), 1)
  LOOP
    IF pg_catalog.pg_terminate_backend(rec.pid) THEN
      killed := killed + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'killed', killed,
    'idle_seconds', EXTRACT(EPOCH FROM idle_cutoff)::integer,
    'xact_seconds', EXTRACT(EPOCH FROM xact_cutoff)::integer
  );
END;
$$;

REVOKE ALL ON FUNCTION public.relieve_db_connection_pressure(integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.relieve_db_connection_pressure(integer, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.claim_db_capacity_alert(
  p_key text,
  p_cooldown_minutes integer DEFAULT 30
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer := 0;
BEGIN
  IF p_key IS NULL OR btrim(p_key) = '' THEN
    RETURN false;
  END IF;

  INSERT INTO public.db_capacity_alert_state (key, last_claimed_at)
  VALUES (p_key, now())
  ON CONFLICT (key) DO UPDATE
    SET last_claimed_at = now()
    WHERE public.db_capacity_alert_state.last_claimed_at IS NULL
       OR public.db_capacity_alert_state.last_claimed_at
          < now() - make_interval(mins => GREATEST(COALESCE(p_cooldown_minutes, 30), 1));

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_db_capacity_alert(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_db_capacity_alert(text, integer) TO service_role;

-- Schedule only when this project's own URL is in Vault — never hardcode
-- Production from a Staging migration apply.
DO $db_capacity_cron$
DECLARE
  worker_secret text;
  project_url text;
  existing_job bigint;
  functions_url text;
BEGIN
  SELECT decrypted_secret
  INTO worker_secret
  FROM vault.decrypted_secrets
  WHERE name IN (
    'CAMPAIGN_PULSE_CRON_SECRET',
    'service_role_key',
    'SUPABASE_SERVICE_ROLE_KEY',
    'task_worker_anon_key'
  )
  ORDER BY CASE name
    WHEN 'CAMPAIGN_PULSE_CRON_SECRET' THEN 0
    WHEN 'service_role_key' THEN 1
    WHEN 'SUPABASE_SERVICE_ROLE_KEY' THEN 2
    ELSE 3
  END
  LIMIT 1;

  SELECT decrypted_secret
  INTO project_url
  FROM vault.decrypted_secrets
  WHERE name IN ('SUPABASE_URL', 'project_url')
  ORDER BY CASE name WHEN 'SUPABASE_URL' THEN 0 ELSE 1 END
  LIMIT 1;

  IF worker_secret IS NULL OR worker_secret = '' OR project_url IS NULL OR project_url = '' THEN
    RAISE NOTICE 'db-capacity-guard cron not scheduled (need Vault SUPABASE_URL + cron secret). Use supabase/ops/install_db_capacity_guard_cron.sql';
    RETURN;
  END IF;

  functions_url := rtrim(project_url, '/') || '/functions/v1/db-capacity-guard';

  SELECT jobid INTO existing_job
  FROM cron.job
  WHERE jobname = 'db-capacity-guard-every-2-min'
  LIMIT 1;
  IF existing_job IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job);
  END IF;

  PERFORM cron.schedule(
    'db-capacity-guard-every-2-min',
    '*/2 * * * *',
    format(
      $cron$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer %s'
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 20000
      );
      $cron$,
      functions_url,
      worker_secret
    )
  );
END;
$db_capacity_cron$;
