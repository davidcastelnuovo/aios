-- WhatsApp LID activation handshake.
--
-- WhatsApp hides many senders behind anonymous LIDs, and the Manus gateway does
-- not forward the real number (no senderPn) — so a newly allow-listed phone can
-- write to Carmen and be silently blocked (its LID matches nothing). Reverse
-- flow, per David: the moment a phone is ADDED to carmen_allowed_phones, Carmen
-- proactively sends it a one-time activation message with a short code; the
-- person's reply carrying that code (or quoting the message) proves ownership,
-- and manus-wa-webhook learns the LID→phone mapping permanently (wa_lid_map).

create table if not exists public.wa_pending_activations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  integration_id uuid,
  phone text not null,
  code text not null,
  activation_message_id text,
  status text not null default 'pending' check (status in ('pending','completed','expired')),
  completed_lid text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.wa_pending_activations enable row level security;
-- Service-role only (webhook + activation function); no client policies.

create index if not exists idx_wa_pending_activations_lookup
  on public.wa_pending_activations (tenant_id, status, created_at desc);

-- Send an activation message to a phone (idempotent: skips phones already
-- mapped in wa_lid_map or with a fresh pending activation). SECURITY DEFINER so
-- the automation-config trigger can read the Vault bearer, mirroring
-- claude_notify_david().
create or replace function public.carmen_send_activation(
  p_tenant uuid,
  p_integration uuid,
  p_phone text
) returns jsonb
language plpgsql security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_bearer text;
  v_code text;
  v_id uuid;
  v_req bigint;
  v_digits text;
begin
  v_digits := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  if length(v_digits) < 9 then
    return jsonb_build_object('ok', false, 'error', 'invalid_phone');
  end if;

  if exists (select 1 from public.wa_lid_map where phone = v_digits) then
    return jsonb_build_object('ok', true, 'skipped', 'already_mapped');
  end if;

  if exists (
    select 1 from public.wa_pending_activations
    where tenant_id = p_tenant and phone = v_digits and status = 'pending'
      and created_at > now() - interval '48 hours'
  ) then
    return jsonb_build_object('ok', true, 'skipped', 'pending_exists');
  end if;

  v_code := lpad((floor(random() * 10000))::int::text, 4, '0');
  insert into public.wa_pending_activations (tenant_id, integration_id, phone, code)
  values (p_tenant, p_integration, v_digits, v_code)
  returning id into v_id;

  select decrypted_secret into v_bearer
  from vault.decrypted_secrets where name = 'claude_mcp_bearer' limit 1;

  select net.http_post(
    url := 'https://zvoijyneresvkadpprel.supabase.co/functions/v1/carmen-activate-phone',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce(v_bearer, '')
    ),
    body := jsonb_build_object(
      'activation_id', v_id::text,
      'tenant_id', p_tenant::text,
      'integration_id', coalesce(p_integration::text, ''),
      'phone', v_digits,
      'code', v_code
    )
  ) into v_req;

  return jsonb_build_object('ok', true, 'activation_id', v_id, 'request_id', v_req);
end;
$$;

-- Fire activation for every phone newly added to a Carmen trigger's
-- carmen_allowed_phones. Config saves must never fail because of activation
-- plumbing — swallow all errors.
create or replace function public.carmen_allowed_phones_trigger()
returns trigger
language plpgsql security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_new jsonb;
  v_old jsonb;
  v_phone text;
  v_integ uuid;
begin
  if new.action_type is distinct from 'carmen_whatsapp_session'
     or new.step_type is distinct from 'trigger' then
    return new;
  end if;
  v_new := coalesce(new.configuration -> 'carmen_allowed_phones', '[]'::jsonb);
  v_old := case when tg_op = 'UPDATE'
    then coalesce(old.configuration -> 'carmen_allowed_phones', '[]'::jsonb)
    else '[]'::jsonb end;
  if v_new = v_old then
    return new;
  end if;
  v_integ := nullif(new.configuration ->> 'carmen_integration_id', '')::uuid;
  for v_phone in select jsonb_array_elements_text(v_new)
  loop
    -- Compare on normalized digits so formatting edits don't re-trigger sends
    -- (carmen_send_activation is idempotent anyway).
    if not exists (
      select 1 from jsonb_array_elements_text(v_old) o(val)
      where regexp_replace(o.val, '\D', '', 'g') = regexp_replace(v_phone, '\D', '', 'g')
    ) then
      perform public.carmen_send_activation(new.tenant_id, v_integ, v_phone);
    end if;
  end loop;
  return new;
exception when others then
  return new;
end;
$$;

drop trigger if exists trg_carmen_allowed_phones_activation on public.automation_flow_steps;
create trigger trg_carmen_allowed_phones_activation
  after insert or update of configuration on public.automation_flow_steps
  for each row execute function public.carmen_allowed_phones_trigger();
