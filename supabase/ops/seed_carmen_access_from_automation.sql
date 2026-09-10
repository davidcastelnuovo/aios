-- Seed carmen_access_policies from existing carmen_whatsapp_session automation steps.
-- Safe to re-run: upserts by (tenant_id, agent_id).

insert into public.carmen_access_policies (
  tenant_id,
  agent_id,
  private_phones,
  allowed_group_ids,
  require_direct_address,
  open_member_groups,
  updated_at
)
select
  s.tenant_id,
  coalesce(
    nullif(s.configuration->>'agent_id', '')::uuid,
    (
      select a.id
      from public.ai_agents a
      where a.tenant_id = s.tenant_id
        and (a.name ilike '%carmen%' or a.name ilike '%כרמן%')
      order by a.active desc nulls last, a.created_at
      limit 1
    )
  ) as agent_id,
  coalesce(
    (
      select jsonb_agg(jsonb_build_object('phone', p, 'surfaces', jsonb_build_array('whatsapp_private')))
      from jsonb_array_elements_text(coalesce(s.configuration->'carmen_allowed_phones', '[]'::jsonb)) as p
    ),
    '[]'::jsonb
  ) as private_phones,
  coalesce(
    (
      select array_agg(wg.id)
      from public.whatsapp_groups wg
      where wg.tenant_id = s.tenant_id
        and (
          wg.group_chat_id = any(
            select jsonb_array_elements_text(
              coalesce(s.configuration->'carmen_allowed_group_ids', '[]'::jsonb)
            )
          )
          or wg.id::text = coalesce(s.configuration->>'carmen_allowed_group_id', '')
          or wg.group_chat_id = coalesce(s.configuration->>'carmen_allowed_group_id', '')
        )
    ),
    '{}'::uuid[]
  ) as allowed_group_ids,
  true as require_direct_address,
  coalesce((s.configuration->>'carmen_open_member_groups')::boolean, false) as open_member_groups,
  now() as updated_at
from public.automation_flow_steps s
where s.step_type = 'trigger'
  and s.action_type = 'carmen_whatsapp_session'
  and coalesce(
    nullif(s.configuration->>'agent_id', '')::uuid,
    (
      select a.id
      from public.ai_agents a
      where a.tenant_id = s.tenant_id
        and (a.name ilike '%carmen%' or a.name ilike '%כרמן%')
      limit 1
    )
  ) is not null
on conflict (tenant_id, agent_id) do update set
  private_phones = excluded.private_phones,
  allowed_group_ids = case
    when cardinality(excluded.allowed_group_ids) > 0 then excluded.allowed_group_ids
    else public.carmen_access_policies.allowed_group_ids
  end,
  open_member_groups = excluded.open_member_groups,
  require_direct_address = excluded.require_direct_address,
  updated_at = now();
