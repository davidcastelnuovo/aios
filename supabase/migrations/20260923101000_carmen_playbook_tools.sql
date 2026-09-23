UPDATE public.ai_agents
SET allowed_tools = (
  SELECT array_agg(DISTINCT t)
  FROM unnest(
    COALESCE(allowed_tools, ARRAY[]::text[])
    || ARRAY[
      'execute_client_operation_playbook',
      'verify_client_operation_recommendation'
    ]::text[]
  ) AS t
),
updated_at = now()
WHERE tenant_id = '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'
  AND engine IS NOT NULL;

UPDATE public.ai_skills
SET
  system_prompt = system_prompt || E'\n\nClient Ops playbooks (docs/client-ops-signal-framework.md): each open recommendation has signal_kind + problem_summary. Use execute_client_operation_playbook to create the right internal task (assignee from playbook — usually client primary campaigner). Follow up with verify_client_operation_recommendation. Never auto-reply in Green API groups.',
  allowed_tools = (
    SELECT array_agg(DISTINCT t)
    FROM unnest(
      COALESCE(allowed_tools, ARRAY[]::text[])
      || ARRAY['execute_client_operation_playbook', 'verify_client_operation_recommendation']::text[]
    ) AS t
  ),
  updated_at = now()
WHERE slug = 'carmen_operations_control_layer'
  AND tenant_id = '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019';
