-- carmen_mcp_dispatches — Grok Bot (external MCP) → Carmen via carmen-mcp

create table if not exists public.carmen_mcp_dispatches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  tool text not null default 'ask_carmen',
  request_text text not null,
  context text,
  conversation_id uuid,
  tools_used text[],
  status text not null default 'ok',
  error text,
  created_at timestamptz not null default now()
);

comment on table public.carmen_mcp_dispatches is
  'External MCP clients (Grok Bot) → Carmen via carmen-mcp: request, conversation, tools, outcome.';

create index if not exists idx_carmen_mcp_dispatches_tenant_time
  on public.carmen_mcp_dispatches(tenant_id, created_at desc);

alter table public.carmen_mcp_dispatches enable row level security;
-- Writes go through the service role (carmen-mcp edge function), which bypasses RLS.
