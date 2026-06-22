
# Full Schema SQL Export

Goal: produce one `schema.sql` file you can run on a fresh Supabase project to recreate the entire structure (no data). No app code will change.

## What will be included
- All `public` schema tables — columns, types, defaults, NOT NULL, PK/UK/CHECK constraints
- All foreign keys (added after table creation to avoid ordering issues)
- All indexes (non-PK)
- All enums / custom types
- All sequences
- All views
- All functions and triggers in `public`
- `ENABLE ROW LEVEL SECURITY` + every RLS policy
- `GRANT` statements for `anon` / `authenticated` / `service_role`

## What will NOT be included
- Row data (you already have CSVs)
- `auth.*`, `storage.*`, `realtime.*` schemas (Supabase-managed — recreated automatically on a fresh project)
- Edge function secrets / tenant_integrations API keys
- Storage buckets/files

## How it will be built
Query Postgres system catalogs (`pg_class`, `pg_attribute`, `pg_constraint`, `pg_index`, `pg_proc`, `pg_policies`, `pg_type`, `information_schema`) via read-only SQL, assemble the DDL in the correct order:

```text
1. CREATE TYPE (enums)
2. CREATE SEQUENCE
3. CREATE TABLE (no FKs yet)
4. ALTER TABLE ... ADD CONSTRAINT (FKs, after all tables exist)
5. CREATE INDEX
6. CREATE FUNCTION
7. CREATE TRIGGER
8. CREATE VIEW
9. GRANTs
10. ALTER TABLE ... ENABLE RLS
11. CREATE POLICY
```

Output goes to `/mnt/documents/schema.sql` as a single file, delivered as a downloadable artifact.

## Caveats to know up front
- **Supabase-managed objects** (auth schema triggers, `auth.users` FKs) — FKs referencing `auth.users` will be included as-is; they work on any Supabase project because the `auth` schema always exists.
- **`SECURITY DEFINER` functions** — included verbatim. On the new project they'll run as the role that creates them (the migration runner), same as here.
- **Extensions** — I'll prepend `CREATE EXTENSION IF NOT EXISTS` for any extensions the schema depends on (e.g. `pgcrypto`, `uuid-ossp`, `pg_cron` if used).
- **`pg_dump` alternative** — Lovable Cloud blocks `pg_dump`, so this catalog-based reconstruction is the next best thing. It covers ~99% of real cases but may miss extremely obscure objects (event triggers, foreign data wrappers — you don't have any).
- File will be large (181 tables, hundreds of policies) — expect 300–800 KB of SQL.

## Deliverable
A single `<presentation-artifact>` pointing to `/mnt/documents/schema.sql`, plus a short summary of what was extracted (counts of tables / policies / functions / FKs).

Approve and I'll switch to build mode and generate it.
