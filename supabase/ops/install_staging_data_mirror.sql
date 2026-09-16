-- STAGING ONLY. Private bookkeeping; never copied from/to Production.
CREATE SCHEMA IF NOT EXISTS environment_sync;
REVOKE ALL ON SCHEMA environment_sync FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS environment_sync.safety (
  singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
  guard_version integer NOT NULL,
  outbound_blocked boolean NOT NULL DEFAULT false,
  verified_at timestamptz,
  source_sha text
);
ALTER TABLE environment_sync.safety ADD COLUMN IF NOT EXISTS own_origin text;
ALTER TABLE environment_sync.safety ADD COLUMN IF NOT EXISTS edge_versions jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE TABLE IF NOT EXISTS environment_sync.managed_rows (
  table_name text NOT NULL,
  row_key jsonb NOT NULL,
  digest text NOT NULL,
  PRIMARY KEY(table_name,row_key)
);
CREATE TABLE IF NOT EXISTS environment_sync.table_state (
  table_name text PRIMARY KEY,
  last_success_at timestamptz NOT NULL,
  source_rows bigint NOT NULL,
  changed_rows bigint NOT NULL
);
ALTER TABLE environment_sync.safety ENABLE ROW LEVEL SECURITY;
ALTER TABLE environment_sync.managed_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE environment_sync.table_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA environment_sync FROM PUBLIC, anon, authenticated;
-- Deliberately no outbound_blocked=true here: installation is not verification.

-- Invalid source rows are retained for reconciliation, never silently dropped.
-- The source projection excludes credential columns; this private table is not
-- exposed to the application. A run with rejected rows remains incomplete.
CREATE TABLE IF NOT EXISTS environment_sync.rejected_rows (
  table_name text NOT NULL,
  row_key jsonb NOT NULL,
  digest text NOT NULL,
  row_data jsonb NOT NULL,
  sqlstate text NOT NULL,
  constraint_name text,
  column_name text,
  last_attempt_at timestamptz NOT NULL,
  PRIMARY KEY(table_name,row_key)
);
ALTER TABLE environment_sync.rejected_rows ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON environment_sync.rejected_rows FROM PUBLIC, anon, authenticated;

-- Preserve the mapping when an unreferenced logical record receives its
-- canonical Production identifier. This contains identifiers, not row bodies.
CREATE TABLE IF NOT EXISTS environment_sync.key_reconciliations (
  table_name text NOT NULL,
  old_id text NOT NULL,
  new_id text NOT NULL,
  reconciled_at timestamptz NOT NULL,
  PRIMARY KEY(table_name,old_id,new_id)
);
ALTER TABLE environment_sync.key_reconciliations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON environment_sync.key_reconciliations FROM PUBLIC, anon, authenticated;
