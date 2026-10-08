-- integration_health / processed_events were created without the unique
-- constraints their SECURITY DEFINER helpers rely on, so every
-- record_integration_result / check_idempotency call failed with
-- "there is no unique or exclusion constraint matching the ON CONFLICT
-- specification" (visible as repeated Postgres errors + 400s on
-- rpc/record_integration_result during every GA/ads sync).
-- Both tables were empty, so the unique indexes could be added directly.
--
-- Applied to prod via MCP apply_migration on 2026-07-16; IF NOT EXISTS
-- makes this a no-op there.

CREATE UNIQUE INDEX IF NOT EXISTS integration_health_tenant_provider_unique
ON public.integration_health (tenant_id, provider);

CREATE UNIQUE INDEX IF NOT EXISTS processed_events_event_key_unique
ON public.processed_events (event_key);
