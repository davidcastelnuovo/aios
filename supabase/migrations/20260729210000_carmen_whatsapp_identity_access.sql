-- Explicit WhatsApp identity and authorization boundary for Carmen.
-- Presence in an allowed group never grants access by itself.

create table if not exists public.carmen_whatsapp_identities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  phone text not null,
  entity_type text not null check (entity_type in ('campaigner', 'client_contact')),
  entity_id uuid not null,
  client_id uuid references public.clients(id) on delete cascade,
  display_name text,
  role_title text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'revoked')),
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint carmen_whatsapp_identities_phone_format
    check (phone = regexp_replace(phone, '\D', '', 'g') and length(phone) between 9 and 15),
  unique (tenant_id, phone)
);

create table if not exists public.carmen_whatsapp_identity_candidates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  group_id uuid references public.whatsapp_groups(id) on delete cascade,
  group_chat_id text not null,
  phone text,
  whatsapp_lid text,
  whatsapp_name text,
  self_reported_identity text,
  status text not null default 'awaiting_identity'
    check (status in ('awaiting_identity', 'awaiting_approval', 'approved', 'rejected')),
  last_prompted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists carmen_identity_candidates_phone_group_uidx
  on public.carmen_whatsapp_identity_candidates (tenant_id, group_chat_id, phone)
  where phone is not null;
create unique index if not exists carmen_identity_candidates_lid_group_uidx
  on public.carmen_whatsapp_identity_candidates (tenant_id, group_chat_id, whatsapp_lid)
  where whatsapp_lid is not null;
create index if not exists carmen_whatsapp_identities_lookup_idx
  on public.carmen_whatsapp_identities (tenant_id, phone, status);

alter table public.carmen_whatsapp_identities enable row level security;
alter table public.carmen_whatsapp_identity_candidates enable row level security;

create policy "Tenant managers can view Carmen identities"
on public.carmen_whatsapp_identities for select to authenticated
using (tenant_id = public.get_effective_tenant_id() or public.is_super_admin(auth.uid()));

create policy "Tenant managers can manage Carmen identities"
on public.carmen_whatsapp_identities for all to authenticated
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

create policy "Tenant managers can view Carmen identity candidates"
on public.carmen_whatsapp_identity_candidates for select to authenticated
using (tenant_id = public.get_effective_tenant_id() or public.is_super_admin(auth.uid()));

create policy "Tenant managers can manage Carmen identity candidates"
on public.carmen_whatsapp_identity_candidates for all to authenticated
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

create or replace function public.carmen_identity_activation_trigger()
returns trigger
language plpgsql security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_integration uuid;
begin
  new.phone := regexp_replace(coalesce(new.phone, ''), '\D', '', 'g');
  new.updated_at := now();
  if new.status = 'approved'
     and new.verified_at is null
     and (tg_op = 'INSERT' or old.status is distinct from 'approved') then
    new.approved_by := coalesce(new.approved_by, auth.uid());
    new.approved_at := coalesce(new.approved_at, now());
    select id into v_integration
    from public.tenant_integrations
    where tenant_id = new.tenant_id
      and integration_type = 'manus_wa'
      and is_active = true
    order by updated_at desc
    limit 1;
    perform public.carmen_send_activation(new.tenant_id, v_integration, new.phone);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_carmen_identity_activation on public.carmen_whatsapp_identities;
create trigger trg_carmen_identity_activation
before insert or update on public.carmen_whatsapp_identities
for each row execute function public.carmen_identity_activation_trigger();

revoke all on table public.carmen_whatsapp_identities from anon;
revoke all on table public.carmen_whatsapp_identity_candidates from anon;
grant select, insert, update, delete on table public.carmen_whatsapp_identities to authenticated;
grant select, insert, update, delete on table public.carmen_whatsapp_identity_candidates to authenticated;
