-- Apply on hosted project if migration not yet merged.
-- Grok Bot → Carmen dispatch log for carmen-mcp.

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

create index if not exists idx_carmen_mcp_dispatches_tenant_time
  on public.carmen_mcp_dispatches(tenant_id, created_at desc);

alter table public.carmen_mcp_dispatches enable row level security;
