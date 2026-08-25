-- grok_dispatches + grok_sticky_agents — Carmen → Grok Bot Cloud Agent
-- Parallel to cursor_dispatches / cursor_sticky_agents so the two conversations stay separate.

create table if not exists public.grok_dispatches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  agent_id uuid,
  tool text not null check (tool in ('request_dev_task', 'ask_grok')),
  request_text text not null,
  context text,
  branch text,
  session_url text,
  cursor_agent_id text,
  status text not null default 'dispatched',
  created_at timestamptz not null default now()
);

comment on table public.grok_dispatches is
  'Carmen → Grok Bot Cloud Agent dispatches: what Carmen asked, the agent URL, and status.';

create index if not exists idx_grok_dispatches_tenant_time
  on public.grok_dispatches(tenant_id, created_at desc);

alter table public.grok_dispatches enable row level security;
-- Writes go through the service role (grok-mcp edge function), which bypasses RLS.

create table if not exists public.grok_sticky_agents (
  tenant_id uuid primary key,
  cursor_agent_id text not null,
  session_url text,
  updated_at timestamptz not null default now()
);

comment on table public.grok_sticky_agents is
  'Maps tenant → durable Grok Cloud Agent id (bc-…). grok-mcp reuses it via POST /v1/agents/{id}/runs.';

alter table public.grok_sticky_agents enable row level security;
