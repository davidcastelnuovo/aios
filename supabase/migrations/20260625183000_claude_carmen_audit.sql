-- claude_carmen_audit — audit trail of autonomous production changes made by
-- Claude (routine sessions) or Carmen, for safety review. See CLAUDE.md
-- "Safety rules for autonomous fixes".

create table if not exists public.claude_carmen_audit (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  actor text not null check (actor in ('claude','carmen')),
  action text not null,
  target text,
  details jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.claude_carmen_audit is
  'Audit trail of autonomous fixes/actions by Claude (routine sessions) or Carmen on production — for safety review.';

create index if not exists idx_claude_carmen_audit_tenant_time
  on public.claude_carmen_audit(tenant_id, created_at desc);

alter table public.claude_carmen_audit enable row level security;
-- Writes go through the service role (edge functions / SECURITY DEFINER), which
-- bypasses RLS. No broad read policy by default; add one keyed to your tenant
-- membership table when a UI needs to surface the log.
