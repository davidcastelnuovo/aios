UPDATE public.ai_skills
SET
  allowed_tools = (
    SELECT array_agg(DISTINCT t)
    FROM unnest(
      allowed_tools
      || ARRAY[
        'sync_weekly_update_from_green_group',
        'create_commitment_followup',
        'create_task',
        'add_client_update'
      ]::text[]
    ) AS t
  ),
  system_prompt = system_prompt || E'\n\nGroup obligations (Green API read-only): (1) If staff promised action in group and no follow-up — create_commitment_followup (opens task + card note). (2) If weekly update was sent in group but missing on client card — sync_weekly_update_from_green_group (dry_run first). Never reply in the Green group from these tools.',
  updated_at = now()
WHERE tenant_id = '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'
  AND slug = 'carmen_operations_control_layer'
  AND scope = 'tenant';
