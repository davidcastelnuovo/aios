-- cursor_dispatches — durable record of every Carmen → Cursor Cloud Agent dispatch
-- (request_dev_task / ask_cursor in cursor-mcp). Same jobs as claude_dispatches:
-- visibility for David + cross-session memory for the next Cursor agent.

create table if not exists public.cursor_dispatches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  agent_id uuid,
  tool text not null check (tool in ('request_dev_task', 'ask_cursor')),
  request_text text not null,
  context text,
  branch text,
  session_url text,
  cursor_agent_id text,
  status text not null default 'dispatched',
  created_at timestamptz not null default now()
);

comment on table public.cursor_dispatches is
  'Carmen → Cursor Cloud Agent dispatches: what Carmen asked, the agent URL, and status. Powers visibility + cross-session memory in cursor-mcp.';

create index if not exists idx_cursor_dispatches_tenant_time
  on public.cursor_dispatches(tenant_id, created_at desc);

alter table public.cursor_dispatches enable row level security;
-- Writes go through the service role (cursor-mcp edge function), which bypasses RLS.
