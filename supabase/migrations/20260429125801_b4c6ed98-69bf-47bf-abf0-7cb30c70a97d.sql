UPDATE tenant_integrations
SET settings = settings
  || jsonb_build_object('needs_reauth', false, 'reauth_reason', NULL, 'reauth_marked_at', NULL),
  updated_at = now()
WHERE integration_type IN ('google_analytics','google_search_console','google_ads')
  AND is_active = true
  AND (settings->>'needs_reauth')::boolean = true
  AND settings ? 'refresh_token'
  AND length(coalesce(settings->>'refresh_token','')) > 10
  AND (settings->>'connected_at')::timestamptz > now() - interval '1 day';