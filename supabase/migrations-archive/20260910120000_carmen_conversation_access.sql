-- Unified Carmen conversation access: policies, client-group scope, command center access.
-- Source of truth for who may talk to Carmen where, and dev-escalation tier per identity.

-- ── Policy per Carmen agent (tenant-wide defaults) ───────────────────────────
create table if not exists public.carmen_access_policies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  agent_id uuid not null references public.ai_agents(id) on delete cascade,
  private_phones jsonb not null default '[]'::jsonb,
  allowed_group_ids uuid[] not null default '{}',
  require_direct_address boolean not null default true,
  open_member_groups boolean not null default false,
  deny_message_he text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, agent_id)
);

comment on column public.carmen_access_policies.private_phones is
  'Array of {phone, label?, campaigner_id?, client_id?, dev_escalation_tier?, surfaces?}.';

-- ── Client ↔ group conversation scope ─────────────────────────────────────────
create table if not exists public.carmen_client_group_access (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  whatsapp_group_id uuid not null references public.whatsapp_groups(id) on delete cascade,
  allow_client_contacts boolean not null default true,
  allow_assigned_campaigners boolean not null default true,
  info_boundary text not null default 'external_only'
    check (info_boundary in ('external_only', 'full')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, client_id, whatsapp_group_id)
);

-- ── Extend identities: surfaces, group scope, dev escalation ────────────────
alter table public.carmen_whatsapp_identities
  add column if not exists surfaces text[] not null default array['whatsapp_private', 'whatsapp_group']::text[],
  add column if not exists allowed_group_ids uuid[],
  add column if not exists scope_mode text not null default 'assigned_clients'
    check (scope_mode in ('org', 'assigned_clients', 'single_client')),
  add column if not exists dev_escalation_tier text
    check (dev_escalation_tier is null or dev_escalation_tier in ('full', 'bugfix')),
  add column if not exists escalation_agents text[] not null default '{}'::text[];

-- ── Command Center / in-app access ───────────────────────────────────────────
create table if not exists public.carmen_command_center_access (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  agent_id uuid not null references public.ai_agents(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  campaigner_id uuid references public.campaigners(id) on delete cascade,
  dev_escalation_tier text
    check (dev_escalation_tier is null or dev_escalation_tier in ('full', 'bugfix')),
  surfaces text[] not null default array['command_center']::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint carmen_cc_access_subject_chk check (
    user_id is not null or campaigner_id is not null
  )
);

create unique index if not exists carmen_cc_access_user_uidx
  on public.carmen_command_center_access (tenant_id, agent_id, user_id)
  where user_id is not null;
create unique index if not exists carmen_cc_access_campaigner_uidx
  on public.carmen_command_center_access (tenant_id, agent_id, campaigner_id)
  where campaigner_id is not null;

create index if not exists carmen_access_policies_tenant_idx
  on public.carmen_access_policies (tenant_id, agent_id);
create index if not exists carmen_client_group_access_lookup_idx
  on public.carmen_client_group_access (tenant_id, whatsapp_group_id, client_id);

-- ── RLS (tenant managers, same as carmen_whatsapp_identities) ───────────────
alter table public.carmen_access_policies enable row level security;
alter table public.carmen_client_group_access enable row level security;
alter table public.carmen_command_center_access enable row level security;

create policy "Managers view carmen access policies"
on public.carmen_access_policies for select to authenticated
using (tenant_id = public.get_effective_tenant_id() or public.is_super_admin(auth.uid()));

create policy "Managers manage carmen access policies"
on public.carmen_access_policies for all to authenticated
using (
  (tenant_id = public.get_effective_tenant_id() or public.is_super_admin(auth.uid()))
  and (
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
    or public.has_role(auth.uid(), 'owner'::public.app_role)
    or public.has_role(auth.uid(), 'agency_owner'::public.app_role)
    or public.has_role(auth.uid(), 'team_manager'::public.app_role)
  )
)
with check (
  (tenant_id = public.get_effective_tenant_id() or public.is_super_admin(auth.uid()))
  and (
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
    or public.has_role(auth.uid(), 'owner'::public.app_role)
    or public.has_role(auth.uid(), 'agency_owner'::public.app_role)
    or public.has_role(auth.uid(), 'team_manager'::public.app_role)
  )
);

create policy "Managers view carmen client group access"
on public.carmen_client_group_access for select to authenticated
using (tenant_id = public.get_effective_tenant_id() or public.is_super_admin(auth.uid()));

create policy "Managers manage carmen client group access"
on public.carmen_client_group_access for all to authenticated
using (
  (tenant_id = public.get_effective_tenant_id() or public.is_super_admin(auth.uid()))
  and (
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
    or public.has_role(auth.uid(), 'owner'::public.app_role)
    or public.has_role(auth.uid(), 'agency_owner'::public.app_role)
    or public.has_role(auth.uid(), 'team_manager'::public.app_role)
  )
)
with check (
  (tenant_id = public.get_effective_tenant_id() or public.is_super_admin(auth.uid()))
  and (
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
    or public.has_role(auth.uid(), 'owner'::public.app_role)
    or public.has_role(auth.uid(), 'agency_owner'::public.app_role)
    or public.has_role(auth.uid(), 'team_manager'::public.app_role)
  )
);

create policy "Managers view carmen command center access"
on public.carmen_command_center_access for select to authenticated
using (tenant_id = public.get_effective_tenant_id() or public.is_super_admin(auth.uid()));

create policy "Managers manage carmen command center access"
on public.carmen_command_center_access for all to authenticated
using (
  (tenant_id = public.get_effective_tenant_id() or public.is_super_admin(auth.uid()))
  and (
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
    or public.has_role(auth.uid(), 'owner'::public.app_role)
    or public.has_role(auth.uid(), 'agency_owner'::public.app_role)
    or public.has_role(auth.uid(), 'team_manager'::public.app_role)
  )
)
with check (
  (tenant_id = public.get_effective_tenant_id() or public.is_super_admin(auth.uid()))
  and (
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
    or public.has_role(auth.uid(), 'owner'::public.app_role)
    or public.has_role(auth.uid(), 'agency_owner'::public.app_role)
    or public.has_role(auth.uid(), 'team_manager'::public.app_role)
  )
);

grant select, insert, update, delete on public.carmen_access_policies to authenticated;
grant select, insert, update, delete on public.carmen_client_group_access to authenticated;
grant select, insert, update, delete on public.carmen_command_center_access to authenticated;
