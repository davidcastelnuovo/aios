-- Close unauthenticated read access to public.clients and public.leads.
--
-- Verified against production on 2026-07-31 using only the public anon key
-- (the same key shipped in the frontend bundle and committed in .env):
--   GET /rest/v1/clients?select=id  -> 200, 368 rows
--   GET /rest/v1/leads?select=id    -> 200, 3895 rows
-- Readable lead columns included phone, email and notes.
--
-- Every SELECT policy on these tables requires auth.uid(), and no migration has
-- ever run ENABLE ROW LEVEL SECURITY on either table, so the policies were inert.
-- Sibling tables created with explicit RLS (crm_tables, ahrefs_reports,
-- client_credentials, chat_messages, ...) correctly returned zero rows.
--
-- Two independent guards below, so the leak closes whether the cause is RLS
-- being disabled or a table grant to anon:
--   1. REVOKE the anon grant  — PostgREST needs the table privilege to read.
--   2. ENABLE ROW LEVEL SECURITY — activates the existing per-role policies.
--
-- Not a behaviour change for legitimate callers:
--   * app users authenticate, so they use the `authenticated` role
--   * lead intake (webhook-meta-leads, oneoff-psg-import, run-ai-agent) and the
--     public share views (public-dashboard, public-table) use the service role,
--     which bypasses RLS
--   * SELECT/INSERT/UPDATE/DELETE policies already exist on both tables, so
--     enabling RLS does not strand any operation

-- 1. Remove any direct table privilege held by the anonymous role.
REVOKE ALL ON TABLE public.clients FROM anon;
REVOKE ALL ON TABLE public.leads   FROM anon;

-- 2. Make sure the existing policies are actually enforced.
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads   ENABLE ROW LEVEL SECURITY;

-- 3. Keep the roles the application actually uses working.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.clients TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.leads   TO authenticated;
GRANT ALL ON TABLE public.clients TO service_role;
GRANT ALL ON TABLE public.leads   TO service_role;
