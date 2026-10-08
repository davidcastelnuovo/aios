-- Daily GSC keyword aggregates for fast SEO share links + internal cache reads.
-- seo_share_response_cache: cross-instance persistent cache for public SEO payloads.

CREATE TABLE public.gsc_keyword_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  client_id UUID,
  site_url TEXT NOT NULL,
  period_key TEXT NOT NULL CHECK (period_key IN ('current_90d', 'prev_month', 'three_month', 'yearly')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  keywords JSONB NOT NULL DEFAULT '[]'::jsonb,
  row_count INTEGER NOT NULL DEFAULT 0,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, site_url, period_key)
);

CREATE INDEX idx_gsc_keyword_snapshots_client
  ON public.gsc_keyword_snapshots (tenant_id, client_id, period_key);

CREATE INDEX idx_gsc_keyword_snapshots_synced
  ON public.gsc_keyword_snapshots (synced_at DESC);

ALTER TABLE public.gsc_keyword_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gsc_keyword_snapshots_tenant_access"
ON public.gsc_keyword_snapshots
FOR ALL
TO authenticated
USING (
  tenant_id IN (
    SELECT tu.tenant_id FROM public.tenant_users tu WHERE tu.user_id = auth.uid()
  )
  OR is_super_admin(auth.uid())
  OR (client_id IS NOT NULL AND user_has_cross_tenant_client_access(auth.uid(), client_id))
)
WITH CHECK (
  tenant_id IN (
    SELECT tu.tenant_id FROM public.tenant_users tu WHERE tu.user_id = auth.uid()
  )
  OR is_super_admin(auth.uid())
  OR (client_id IS NOT NULL AND user_has_cross_tenant_client_access(auth.uid(), client_id))
);

CREATE TRIGGER gsc_keyword_snapshots_updated_at
  BEFORE UPDATE ON public.gsc_keyword_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Persistent SEO share response cache (service-role writes from edge functions).
CREATE TABLE public.seo_share_response_cache (
  share_token TEXT NOT NULL PRIMARY KEY,
  payload JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_seo_share_response_cache_expires
  ON public.seo_share_response_cache (expires_at);

ALTER TABLE public.seo_share_response_cache ENABLE ROW LEVEL SECURITY;

-- No authenticated access — edge functions use service role only.
CREATE POLICY "seo_share_response_cache_deny_authenticated"
ON public.seo_share_response_cache
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);

CREATE TRIGGER seo_share_response_cache_updated_at
  BEFORE UPDATE ON public.seo_share_response_cache
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Daily GSC keyword sync at 04:30 UTC (after most other morning crons).
DO $gsc_cron$
DECLARE
  worker_secret text;
  existing_job bigint;
BEGIN
  SELECT decrypted_secret
  INTO worker_secret
  FROM vault.decrypted_secrets
  WHERE name IN ('task_worker_anon_key', 'SUPABASE_ANON_KEY', 'service_role_key', 'SUPABASE_SERVICE_ROLE_KEY')
  ORDER BY CASE name
    WHEN 'task_worker_anon_key' THEN 0
    WHEN 'SUPABASE_ANON_KEY' THEN 1
    WHEN 'service_role_key' THEN 2
    ELSE 3
  END
  LIMIT 1;

  IF worker_secret IS NULL OR worker_secret = '' THEN
    RAISE NOTICE 'No cron auth secret in Vault; GSC keyword cron not scheduled';
    RETURN;
  END IF;

  SELECT jobid INTO existing_job
  FROM cron.job
  WHERE jobname = 'cron-sync-gsc-keywords-daily'
  LIMIT 1;
  IF existing_job IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job);
  END IF;

  PERFORM cron.schedule(
    'cron-sync-gsc-keywords-daily',
    '30 4 * * *',
    format(
      $cron$
      SELECT net.http_post(
        url := 'https://zvoijyneresvkadpprel.supabase.co/functions/v1/cron-sync-gsc-keywords',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer %s'
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 300000
      );
      $cron$,
      worker_secret
    )
  );
END;
$gsc_cron$;
