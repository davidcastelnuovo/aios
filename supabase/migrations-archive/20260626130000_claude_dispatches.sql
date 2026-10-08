-- claude_dispatches — durable record of every Carmen → Claude routine dispatch
-- (the `request_dev_task` / `ask_claude` MCP tools in claude-mcp). Each row is one
-- fired Claude Code session: what Carmen asked, the live session URL to watch it,
-- and a status that later updates can advance. Two jobs:
--   1. Visibility — give David a place to see what Carmen asked Claude and follow
--      the running session (surfaced immediately over WhatsApp, durable here).
--   2. Memory — claude-mcp reads recent rows back into each new session so a fresh
--      Claude routine run knows what was already asked and doesn't start from zero.

create table if not exists public.claude_dispatches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  agent_id uuid,
  tool text not null check (tool in ('request_dev_task', 'ask_claude')),
  request_text text not null,
  context text,
  branch text,
  session_url text,
  status text not null default 'dispatched',
  created_at timestamptz not null default now()
);

comment on table public.claude_dispatches is
  'Carmen → Claude routine dispatches: what Carmen asked, the Claude Code session URL, and status. Powers dispatch visibility + cross-session memory in claude-mcp.';

create index if not exists idx_claude_dispatches_tenant_time
  on public.claude_dispatches(tenant_id, created_at desc);

alter table public.claude_dispatches enable row level security;
-- Writes go through the service role (claude-mcp edge function), which bypasses
-- RLS. No broad read policy by default; add one keyed to your tenant membership
-- table when a UI needs to surface the log.
