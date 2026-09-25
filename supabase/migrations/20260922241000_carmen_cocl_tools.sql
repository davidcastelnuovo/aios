-- COCL read tools + skin prompt refresh (Phase 1a).

UPDATE public.ai_skills
SET
  system_prompt = replace(
    system_prompt,
    'Until operation-control-center tools exist, use list_dev_tasks',
    'Use list_operation_runs / get_operation_run for PEVR visibility; also list_dev_tasks'
  ),
  allowed_tools = (
    SELECT array_agg(DISTINCT t)
    FROM unnest(
      COALESCE(allowed_tools, ARRAY[]::text[])
      || ARRAY['list_operation_runs', 'get_operation_run']::text[]
    ) AS t
  ),
  updated_at = now()
WHERE slug = 'carmen_operations_control_layer'
  AND tenant_id = '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019';

UPDATE public.ai_agents
SET allowed_tools = (
  SELECT array_agg(DISTINCT t)
  FROM unnest(
    COALESCE(allowed_tools, ARRAY[]::text[])
    || ARRAY['list_operation_runs', 'get_operation_run']::text[]
  ) AS t
),
updated_at = now()
WHERE tenant_id = '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'
  AND engine IS NOT NULL;
