-- Google Analytics OAuth rows default to connection_visibility = private, so
-- user_has_integration_permission is true only for the Google account owner.
-- SEO staff (Yuval) could not use David's or Anna's Analytics connections.
-- Report connections are tenant-scoped: anyone in the tenant may use them.

UPDATE public.tenant_integrations
SET
  connection_visibility = 'org',
  updated_at = now()
WHERE integration_type = 'google_analytics'
  AND is_active = true
  AND user_id IS NOT NULL
  AND connection_visibility = 'private';
