-- Meta accepts a template send and returns a message id straight away, so the
-- automation run is logged as a success. The real outcome only arrives minutes
-- later on the status webhook, which until now was recorded on the chat message
-- alone. A run whose lead alert Meta refused to deliver therefore stayed green in
-- the run history and the failure went unnoticed.

CREATE INDEX IF NOT EXISTS automation_logs_provider_message_ids_idx
  ON public.automation_logs
  USING gin ((jsonb_path_query_array(response, '$.**.messageId'::jsonpath, '{}'::jsonb, false)) jsonb_path_ops);

CREATE OR REPLACE FUNCTION public.mark_automation_log_delivery_failure(
  p_provider_message_id text,
  p_error jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id uuid;
  v_code text;
  v_detail text;
  v_reason text;
BEGIN
  IF coalesce(p_provider_message_id, '') = '' THEN
    RETURN false;
  END IF;

  SELECT id INTO v_log_id
  FROM public.automation_logs
  WHERE triggered_at > now() - interval '7 days'
    AND jsonb_path_query_array(response, '$.**.messageId'::jsonpath, '{}'::jsonb, false)
        @> to_jsonb(p_provider_message_id)
  ORDER BY triggered_at DESC
  LIMIT 1;

  IF v_log_id IS NULL THEN
    RETURN false;
  END IF;

  v_code := nullif(p_error->>'code', '');
  v_detail := coalesce(
    nullif(p_error->'error_data'->>'details', ''),
    nullif(p_error->>'title', ''),
    nullif(p_error->>'message', ''),
    'סיבה לא ידועה'
  );
  v_reason := 'Meta לא מסרה את ההודעה'
    || coalesce(' (קוד ' || v_code || ')', '')
    || ': ' || v_detail;

  -- Meta re-sends the same status on retry, so only record a reason once.
  UPDATE public.automation_logs
  SET success = false,
      error_message = left(
        coalesce(nullif(error_message, '') || ' | ', '') || v_reason,
        1000
      )
  WHERE id = v_log_id
    AND (success IS DISTINCT FROM false OR coalesce(error_message, '') NOT LIKE '%' || v_reason || '%');

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_automation_log_delivery_failure(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_automation_log_delivery_failure(text, jsonb) TO service_role;
