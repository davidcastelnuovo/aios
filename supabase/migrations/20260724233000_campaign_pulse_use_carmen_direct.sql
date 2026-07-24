-- Deliver campaign pulse reports through each tenant's existing Carmen Direct
-- automation. A separately configured phone number is no longer required.

create or replace function public.claim_campaign_pulse_delivery(p_tenant_id uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_claimed boolean;
begin
  update public.tenant_heartbeat_settings
  set campaign_pulse_last_sent_at = now()
  where tenant_id = p_tenant_id
    and campaign_pulse_enabled = true
    and (
      campaign_pulse_last_sent_at is null
      or campaign_pulse_last_sent_at < now() - interval '4 hours'
    )
  returning true into v_claimed;

  return coalesce(v_claimed, false);
end;
$$;

revoke all on function public.claim_campaign_pulse_delivery(uuid) from public, anon, authenticated;
grant execute on function public.claim_campaign_pulse_delivery(uuid) to service_role;
