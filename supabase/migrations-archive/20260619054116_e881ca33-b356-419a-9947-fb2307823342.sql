
CREATE OR REPLACE FUNCTION public.list_system_cron_jobs()
RETURNS TABLE (jobid bigint, jobname text, schedule text, active boolean, command text, last_run_at timestamptz, last_status text, last_duration_ms bigint, last_return_message text, success_count_7d bigint, fail_count_7d bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, cron AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'permission denied'; END IF;
  RETURN QUERY
  WITH last_run AS (
    SELECT DISTINCT ON (d.jobid) d.jobid, d.start_time AS last_run_at, d.status AS last_status,
      EXTRACT(EPOCH FROM (d.end_time - d.start_time))::bigint * 1000 AS last_duration_ms, d.return_message AS last_return_message
    FROM cron.job_run_details d ORDER BY d.jobid, d.start_time DESC
  ),
  stats AS (
    SELECT d.jobid, COUNT(*) FILTER (WHERE d.status='succeeded') AS success_count_7d, COUNT(*) FILTER (WHERE d.status='failed') AS fail_count_7d
    FROM cron.job_run_details d WHERE d.start_time > now() - interval '7 days' GROUP BY d.jobid
  )
  SELECT j.jobid, j.jobname, j.schedule, j.active, j.command, lr.last_run_at, lr.last_status, lr.last_duration_ms, lr.last_return_message,
    COALESCE(s.success_count_7d, 0), COALESCE(s.fail_count_7d, 0)
  FROM cron.job j LEFT JOIN last_run lr ON lr.jobid=j.jobid LEFT JOIN stats s ON s.jobid=j.jobid ORDER BY j.jobname;
END; $$;

CREATE OR REPLACE FUNCTION public.get_cron_job_history(p_jobid bigint, p_limit int DEFAULT 50)
RETURNS TABLE (runid bigint, start_time timestamptz, end_time timestamptz, status text, return_message text, duration_ms bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, cron AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'permission denied'; END IF;
  RETURN QUERY SELECT d.runid, d.start_time, d.end_time, d.status, d.return_message,
    EXTRACT(EPOCH FROM (d.end_time - d.start_time))::bigint * 1000
  FROM cron.job_run_details d WHERE d.jobid = p_jobid ORDER BY d.start_time DESC LIMIT p_limit;
END; $$;

CREATE OR REPLACE FUNCTION public.update_system_cron_job(p_jobid bigint, p_schedule text DEFAULT NULL, p_active boolean DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, cron AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'permission denied'; END IF;
  IF p_schedule IS NOT NULL THEN PERFORM cron.alter_job(job_id := p_jobid, schedule := p_schedule); END IF;
  IF p_active IS NOT NULL THEN PERFORM cron.alter_job(job_id := p_jobid, active := p_active); END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.run_system_cron_job_now(p_jobid bigint)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, cron AS $$
DECLARE v_command text;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'permission denied'; END IF;
  SELECT command INTO v_command FROM cron.job WHERE jobid = p_jobid;
  IF v_command IS NULL THEN RAISE EXCEPTION 'job not found'; END IF;
  EXECUTE v_command;
  RETURN 'ok';
END; $$;
