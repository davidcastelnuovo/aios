-- Applied via .github/workflows/apply-sql-migration.yml
-- Source: supabase/migrations/20260803190000_cursor_sticky_agents.sql

create table if not exists public.cursor_sticky_agents (
  tenant_id uuid primary key,
  cursor_agent_id text not null,
  session_url text,
  updated_at timestamptz not null default now()
);

comment on table public.cursor_sticky_agents is
  'Maps tenant → durable Cursor Cloud Agent id (bc-…). cursor-mcp reuses it via POST /v1/agents/{id}/runs.';

alter table public.cursor_sticky_agents enable row level security;
