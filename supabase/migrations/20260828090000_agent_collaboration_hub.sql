-- Shared coordination hub for Codex, Cursor, Carmen and Grok Bot.
-- Service-role MCP functions write here; no client-facing policies are added.

create table if not exists public.agent_collaboration_agents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  agent_key text not null,
  display_name text not null,
  capabilities text[] not null default '{}',
  status text not null default 'online'
    check (status in ('online', 'busy', 'offline')),
  current_task_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (tenant_id, agent_key)
);

create table if not exists public.agent_collaboration_tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  title text not null,
  description text not null default '',
  status text not null default 'open'
    check (status in ('open', 'claimed', 'in_progress', 'blocked', 'review', 'completed', 'cancelled')),
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'urgent')),
  created_by text not null,
  assigned_to text,
  branch text,
  pull_request_url text,
  preview_url text,
  acceptance_criteria text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  claimed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.agent_collaboration_agents
  drop constraint if exists agent_collaboration_agents_current_task_id_fkey;
alter table public.agent_collaboration_agents
  add constraint agent_collaboration_agents_current_task_id_fkey
  foreign key (current_task_id) references public.agent_collaboration_tasks(id) on delete set null;

create table if not exists public.agent_collaboration_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  task_id uuid references public.agent_collaboration_tasks(id) on delete cascade,
  sender text not null,
  recipient text,
  message_type text not null default 'message'
    check (message_type in ('message', 'status', 'handoff', 'review_request', 'result', 'error')),
  body text not null,
  metadata jsonb not null default '{}'::jsonb,
  read_by text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists idx_agent_collaboration_tasks_queue
  on public.agent_collaboration_tasks(tenant_id, status, priority, created_at);
create index if not exists idx_agent_collaboration_tasks_assignee
  on public.agent_collaboration_tasks(tenant_id, assigned_to, updated_at desc);
create index if not exists idx_agent_collaboration_messages_inbox
  on public.agent_collaboration_messages(tenant_id, recipient, created_at desc);
create index if not exists idx_agent_collaboration_messages_task
  on public.agent_collaboration_messages(task_id, created_at);

alter table public.agent_collaboration_agents enable row level security;
alter table public.agent_collaboration_tasks enable row level security;
alter table public.agent_collaboration_messages enable row level security;

comment on table public.agent_collaboration_tasks is
  'Shared task queue for Codex, Cursor, Carmen and Grok Bot. Writes are service-role only.';
