-- Client-facing report delivery is opt-in per report/dashboard. Nothing is
-- scheduled merely because an item is linked to a client.
CREATE TABLE IF NOT EXISTS public.report_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('table', 'dashboard')),
  table_id uuid REFERENCES public.crm_tables(id) ON DELETE CASCADE,
  dashboard_id uuid REFERENCES public.crm_dashboards(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  frequency text NOT NULL DEFAULT 'monthly' CHECK (frequency IN ('weekly', 'monthly')),
  day_of_week smallint CHECK (day_of_week BETWEEN 0 AND 6),
  day_of_month smallint CHECK (day_of_month BETWEEN 1 AND 28),
  send_time time NOT NULL DEFAULT time '09:00',
  timezone text NOT NULL DEFAULT 'Asia/Jerusalem',
  channels text[] NOT NULL DEFAULT ARRAY['whatsapp']::text[],
  whatsapp_group_id uuid REFERENCES public.whatsapp_groups(id) ON DELETE SET NULL,
  phone text,
  email_recipients text[] NOT NULL DEFAULT '{}',
  email_subject text,
  message text,
  next_run_at timestamptz,
  last_run_at timestamptz,
  locked_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT report_schedule_target_matches CHECK (
    (target_type = 'table' AND table_id IS NOT NULL AND dashboard_id IS NULL)
    OR
    (target_type = 'dashboard' AND dashboard_id IS NOT NULL AND table_id IS NULL)
  ),
  CONSTRAINT report_schedule_has_channel CHECK (
    channels <@ ARRAY['whatsapp', 'email']::text[] AND cardinality(channels) > 0
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS report_schedules_unique_table
  ON public.report_schedules (client_id, table_id)
  WHERE table_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS report_schedules_unique_dashboard
  ON public.report_schedules (client_id, dashboard_id)
  WHERE dashboard_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS report_schedules_due
  ON public.report_schedules (next_run_at)
  WHERE enabled = true AND locked_at IS NULL;

CREATE TABLE IF NOT EXISTS public.report_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid REFERENCES public.report_schedules(id) ON DELETE SET NULL,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  channels text[] NOT NULL DEFAULT '{}',
  status text NOT NULL CHECK (status IN ('sent', 'partial', 'failed')),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS report_deliveries_client_created
  ON public.report_deliveries (client_id, created_at DESC);

ALTER TABLE public.report_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant members manage report schedules" ON public.report_schedules;
CREATE POLICY "Tenant members manage report schedules"
  ON public.report_schedules
  FOR ALL TO authenticated
  USING (public.user_is_tenant_member(tenant_id))
  WITH CHECK (public.user_is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "Tenant members view report deliveries" ON public.report_deliveries;
CREATE POLICY "Tenant members view report deliveries"
  ON public.report_deliveries
  FOR SELECT TO authenticated
  USING (public.user_is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "Tenant members log report deliveries" ON public.report_deliveries;
CREATE POLICY "Tenant members log report deliveries"
  ON public.report_deliveries
  FOR INSERT TO authenticated
  WITH CHECK (public.user_is_tenant_member(tenant_id));

CREATE OR REPLACE FUNCTION public.set_report_schedule_next_run()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  local_now timestamp;
  candidate timestamp;
  days_ahead integer;
BEGIN
  NEW.updated_at := now();
  IF NOT NEW.enabled THEN
    NEW.next_run_at := NULL;
    RETURN NEW;
  END IF;

  local_now := timezone(NEW.timezone, now());
  IF NEW.frequency = 'weekly' THEN
    NEW.day_of_week := COALESCE(NEW.day_of_week, 0);
    days_ahead := (NEW.day_of_week - extract(dow FROM local_now)::integer + 7) % 7;
    candidate := date_trunc('day', local_now)
      + days_ahead * interval '1 day'
      + NEW.send_time;
    IF candidate <= local_now THEN candidate := candidate + interval '7 days'; END IF;
  ELSE
    NEW.day_of_month := COALESCE(NEW.day_of_month, 1);
    candidate := date_trunc('month', local_now)
      + (NEW.day_of_month - 1) * interval '1 day'
      + NEW.send_time;
    IF candidate <= local_now THEN candidate := candidate + interval '1 month'; END IF;
  END IF;

  NEW.next_run_at := candidate AT TIME ZONE NEW.timezone;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_report_schedule_next_run ON public.report_schedules;
CREATE TRIGGER trg_set_report_schedule_next_run
BEFORE INSERT OR UPDATE OF enabled, frequency, day_of_week, day_of_month, send_time, timezone, last_run_at
ON public.report_schedules
FOR EACH ROW EXECUTE FUNCTION public.set_report_schedule_next_run();

-- Register the worker only when the dedicated bearer has been provisioned in
-- Vault. This keeps a fresh environment safely disabled until an operator
-- explicitly opts in by adding REPORT_WORKER_SECRET to both Vault and Edge
-- Function secrets.
DO $report_cron$
DECLARE
  worker_secret text;
  existing_job bigint;
BEGIN
  SELECT decrypted_secret
  INTO worker_secret
  FROM vault.decrypted_secrets
  WHERE name = 'REPORT_WORKER_SECRET'
  LIMIT 1;

  IF worker_secret IS NULL OR worker_secret = '' THEN
    RAISE NOTICE 'REPORT_WORKER_SECRET is absent; scheduled report cron remains disabled';
    RETURN;
  END IF;

  SELECT jobid INTO existing_job
  FROM cron.job
  WHERE jobname = 'client-report-delivery'
  LIMIT 1;
  IF existing_job IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job);
  END IF;

  PERFORM cron.schedule(
    'client-report-delivery',
    '*/15 * * * *',
    format(
      $command$
        SELECT net.http_post(
          url := 'https://zvoijyneresvkadpprel.supabase.co/functions/v1/scheduled-report-worker',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', %L
          ),
          body := '{}'::jsonb
        );
      $command$,
      'Bearer ' || worker_secret
    )
  );
EXCEPTION
  WHEN undefined_table OR undefined_function THEN
    RAISE NOTICE 'pg_cron, pg_net, or Vault is unavailable; scheduled report cron remains disabled';
END;
$report_cron$;
