-- Ensure Carmen agent can invoke Client 360 / Green group tools (not only via skin).

UPDATE public.ai_agents
SET allowed_tools = (
  SELECT array_agg(DISTINCT t)
  FROM unnest(
    COALESCE(allowed_tools, ARRAY[]::text[])
    || ARRAY[
      'get_client_operations_package',
      'get_client_green_group_communications',
      'list_client_operation_recommendations',
      'update_client_operation_recommendation',
      'sync_weekly_update_from_green_group',
      'create_commitment_followup'
    ]::text[]
  ) AS t
),
updated_at = now()
WHERE tenant_id = '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'
  AND engine IS NOT NULL;
