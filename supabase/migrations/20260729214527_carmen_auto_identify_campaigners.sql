-- Keep Carmen's WhatsApp identity list synchronized with active campaigners.
-- A phone recorded by an authorized tenant manager is treated as an approved
-- staff identity; runtime group-author resolution still enforces tenant/client scope.

create or replace function public.carmen_normalize_staff_phone(value text)
returns text
language sql
immutable
strict
set search_path = 'pg_catalog'
as $$
  select case
    when regexp_replace(value, '\D', '', 'g') ~ '^0[5-9][0-9]{8}$'
      then '972' || substr(regexp_replace(value, '\D', '', 'g'), 2)
    when regexp_replace(value, '\D', '', 'g') ~ '^[5-9][0-9]{8}$'
      then '972' || regexp_replace(value, '\D', '', 'g')
    else regexp_replace(value, '\D', '', 'g')
  end
$$;

create or replace function public.sync_campaigner_carmen_identity()
returns trigger
language plpgsql
security definer
set search_path = 'pg_catalog', 'public'
as $$
declare
  v_phone text;
  v_old_phone text;
begin
  v_phone := public.carmen_normalize_staff_phone(new.phone);
  if tg_op = 'UPDATE' then
    v_old_phone := public.carmen_normalize_staff_phone(old.phone);
    if v_old_phone <> v_phone
       or old.tenant_id <> new.tenant_id
       or new.active is not true then
      update public.carmen_whatsapp_identities
      set status = 'revoked', updated_at = now()
      where tenant_id = old.tenant_id
        and phone = v_old_phone
        and entity_type = 'campaigner'
        and entity_id = old.id;
    end if;
  end if;

  if new.active is true and length(v_phone) between 9 and 15 then
    insert into public.carmen_whatsapp_identities (
      tenant_id, phone, entity_type, entity_id, display_name, role_title,
      status, approved_at, verified_at
    ) values (
      new.tenant_id, v_phone, 'campaigner', new.id, new.full_name, 'campaigner',
      'approved', now(), now()
    )
    on conflict (tenant_id, phone) do update set
      entity_type = 'campaigner',
      entity_id = excluded.entity_id,
      client_id = null,
      display_name = excluded.display_name,
      role_title = excluded.role_title,
      status = 'approved',
      approved_at = coalesce(public.carmen_whatsapp_identities.approved_at, now()),
      verified_at = coalesce(public.carmen_whatsapp_identities.verified_at, now()),
      updated_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_campaigner_carmen_identity on public.campaigners;
create trigger trg_sync_campaigner_carmen_identity
after insert or update of phone, full_name, active, tenant_id
on public.campaigners
for each row execute function public.sync_campaigner_carmen_identity();

insert into public.carmen_whatsapp_identities (
  tenant_id, phone, entity_type, entity_id, display_name, role_title,
  status, approved_at, verified_at
)
select
  c.tenant_id,
  public.carmen_normalize_staff_phone(c.phone),
  'campaigner',
  c.id,
  c.full_name,
  'campaigner',
  'approved',
  now(),
  now()
from public.campaigners c
where c.active is true
  and length(public.carmen_normalize_staff_phone(c.phone)) between 9 and 15
on conflict (tenant_id, phone) do update set
  entity_type = 'campaigner',
  entity_id = excluded.entity_id,
  client_id = null,
  display_name = excluded.display_name,
  role_title = excluded.role_title,
  status = 'approved',
  approved_at = coalesce(public.carmen_whatsapp_identities.approved_at, now()),
  verified_at = coalesce(public.carmen_whatsapp_identities.verified_at, now()),
  updated_at = now();

revoke all on function public.carmen_normalize_staff_phone(text) from public;
grant execute on function public.carmen_normalize_staff_phone(text) to authenticated, service_role;
revoke all on function public.sync_campaigner_carmen_identity() from public;
