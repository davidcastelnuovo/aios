-- Allow one user to connect MULTIPLE Google Analytics accounts in the same tenant.
--
-- Background: tenant_integrations_user_level_unique enforced one row per
-- (tenant_id, integration_type, user_id). The GA OAuth callback (PR #111)
-- already inserts a NEW row when a different Google account (google_email)
-- connects — but that insert violated this index, so connecting a second
-- Analytics account failed with auth_failed instead of being added.
--
-- Fix: exclude google_analytics from the generic one-per-user index, and
-- enforce uniqueness per Google account instead: one row per
-- (tenant, type, user, google_email). All other integration types keep the
-- exact same one-per-user behavior.

DROP INDEX IF EXISTS tenant_integrations_user_level_unique;

CREATE UNIQUE INDEX IF NOT EXISTS tenant_integrations_user_level_unique
ON public.tenant_integrations (tenant_id, integration_type, user_id)
WHERE user_id IS NOT NULL AND integration_type <> 'google_analytics';

CREATE UNIQUE INDEX IF NOT EXISTS tenant_integrations_ga_user_email_unique
ON public.tenant_integrations (tenant_id, integration_type, user_id, ((settings->>'google_email')))
WHERE user_id IS NOT NULL AND integration_type = 'google_analytics';
