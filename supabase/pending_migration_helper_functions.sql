-- ============================================
-- Resilience Helper Functions
-- Run this migration when DB is available
-- ============================================

-- 1. check_rate_limit
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_tenant_id uuid, p_resource_type text, p_default_max integer DEFAULT 300
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_max integer; v_count integer; v_window timestamptz;
BEGIN
  SELECT max_per_minute, current_count, window_start INTO v_max, v_count, v_window
  FROM tenant_rate_limits WHERE tenant_id = p_tenant_id AND resource_type = p_resource_type;
  IF NOT FOUND THEN
    INSERT INTO tenant_rate_limits (tenant_id, resource_type, max_per_minute, current_count, window_start)
    VALUES (p_tenant_id, p_resource_type, p_default_max, 1, now()) ON CONFLICT (tenant_id, resource_type) DO NOTHING;
    RETURN true;
  END IF;
  IF v_window < now() - interval '1 minute' THEN
    UPDATE tenant_rate_limits SET current_count = 1, window_start = now()
    WHERE tenant_id = p_tenant_id AND resource_type = p_resource_type; RETURN true;
  END IF;
  IF v_count >= v_max THEN RETURN false; END IF;
  UPDATE tenant_rate_limits SET current_count = current_count + 1
  WHERE tenant_id = p_tenant_id AND resource_type = p_resource_type;
  RETURN true;
END; $$;

-- 2. check_circuit_breaker
CREATE OR REPLACE FUNCTION public.check_circuit_breaker(
  p_tenant_id uuid, p_provider text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_record integration_health%ROWTYPE;
BEGIN
  SELECT * INTO v_record FROM integration_health
  WHERE tenant_id = p_tenant_id AND provider = p_provider;
  IF NOT FOUND THEN RETURN true; END IF;
  IF v_record.is_circuit_open THEN
    IF v_record.cooldown_until IS NOT NULL AND now() > v_record.cooldown_until THEN
      UPDATE integration_health SET is_circuit_open = false, consecutive_failures = 0
      WHERE tenant_id = p_tenant_id AND provider = p_provider;
      RETURN true;
    END IF;
    RETURN false;
  END IF;
  RETURN true;
END; $$;

-- 3. record_integration_result
CREATE OR REPLACE FUNCTION public.record_integration_result(
  p_tenant_id uuid, p_provider text, p_success boolean,
  p_failure_threshold integer DEFAULT 5, p_cooldown_minutes integer DEFAULT 5
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_success THEN
    INSERT INTO integration_health (tenant_id, provider, consecutive_failures, last_failure_at, is_circuit_open, cooldown_until)
    VALUES (p_tenant_id, p_provider, 0, NULL, false, NULL)
    ON CONFLICT (tenant_id, provider)
    DO UPDATE SET consecutive_failures = 0, is_circuit_open = false, cooldown_until = NULL;
  ELSE
    INSERT INTO integration_health (tenant_id, provider, consecutive_failures, last_failure_at, is_circuit_open, cooldown_until)
    VALUES (p_tenant_id, p_provider, 1, now(), false, NULL)
    ON CONFLICT (tenant_id, provider)
    DO UPDATE SET
      consecutive_failures = integration_health.consecutive_failures + 1,
      last_failure_at = now(),
      is_circuit_open = CASE WHEN integration_health.consecutive_failures + 1 >= p_failure_threshold THEN true ELSE false END,
      cooldown_until = CASE WHEN integration_health.consecutive_failures + 1 >= p_failure_threshold
        THEN now() + (p_cooldown_minutes || ' minutes')::interval
        ELSE integration_health.cooldown_until END;
  END IF;
END; $$;

-- 4. check_idempotency
CREATE OR REPLACE FUNCTION public.check_idempotency(
  p_tenant_id uuid, p_event_key text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO processed_events (tenant_id, event_key)
  VALUES (p_tenant_id, p_event_key) ON CONFLICT (event_key) DO NOTHING;
  RETURN FOUND;
END; $$;

-- 5. enqueue_job
CREATE OR REPLACE FUNCTION public.enqueue_job(
  p_tenant_id uuid, p_job_type text, p_priority integer DEFAULT 5,
  p_payload jsonb DEFAULT '{}'::jsonb, p_max_attempts integer DEFAULT 3
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_job_id uuid; v_rate_ok boolean;
BEGIN
  v_rate_ok := check_rate_limit(p_tenant_id, p_job_type);
  IF NOT v_rate_ok THEN
    RAISE EXCEPTION 'Rate limit exceeded for tenant % on resource %', p_tenant_id, p_job_type;
  END IF;
  INSERT INTO job_queue (tenant_id, job_type, priority, status, payload, max_attempts)
  VALUES (p_tenant_id, p_job_type, p_priority, 'queued', p_payload, p_max_attempts)
  RETURNING id INTO v_job_id;
  RETURN v_job_id;
END; $$;

-- 6. claim_next_job
CREATE OR REPLACE FUNCTION public.claim_next_job(
  p_job_types text[] DEFAULT NULL
) RETURNS TABLE(id uuid, tenant_id uuid, job_type text, priority integer, payload jsonb, attempts integer, max_attempts integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  UPDATE job_queue jq
  SET status = 'running', started_at = now(), attempts = jq.attempts + 1
  FROM (
    SELECT jq2.id FROM job_queue jq2
    WHERE jq2.status = 'queued'
      AND (p_job_types IS NULL OR jq2.job_type = ANY(p_job_types))
    ORDER BY jq2.priority ASC, jq2.created_at ASC
    LIMIT 1 FOR UPDATE SKIP LOCKED
  ) sub
  WHERE jq.id = sub.id
  RETURNING jq.id, jq.tenant_id, jq.job_type, jq.priority, jq.payload, jq.attempts, jq.max_attempts;
END; $$;

-- 7. complete_job
CREATE OR REPLACE FUNCTION public.complete_job(
  p_job_id uuid, p_success boolean, p_error text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_attempts integer; v_max integer;
BEGIN
  SELECT attempts, max_attempts INTO v_attempts, v_max FROM job_queue WHERE id = p_job_id;
  IF p_success THEN
    UPDATE job_queue SET status = 'done', finished_at = now() WHERE id = p_job_id;
  ELSE
    IF v_attempts >= v_max THEN
      UPDATE job_queue SET status = 'dead_letter', finished_at = now(), error = p_error WHERE id = p_job_id;
    ELSE
      UPDATE job_queue SET status = 'queued', error = p_error, started_at = NULL WHERE id = p_job_id;
    END IF;
  END IF;
END; $$;

-- 8. Cleanup helpers
CREATE OR REPLACE FUNCTION public.cleanup_old_events() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_deleted integer;
BEGIN
  DELETE FROM processed_events WHERE processed_at < now() - interval '7 days';
  GET DIAGNOSTICS v_deleted = ROW_COUNT; RETURN v_deleted;
END; $$;

CREATE OR REPLACE FUNCTION public.cleanup_old_jobs() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_deleted integer;
BEGIN
  DELETE FROM job_queue WHERE status IN ('done', 'dead_letter') AND finished_at < now() - interval '30 days';
  GET DIAGNOSTICS v_deleted = ROW_COUNT; RETURN v_deleted;
END; $$;
