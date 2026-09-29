-- Extend COCL skin with Client 360 tools (Phase 2c).

UPDATE public.ai_skills
SET
  allowed_tools = ARRAY[
    'get_client_operations_package',
    'list_client_operation_recommendations',
    'update_client_operation_recommendation',
    'list_dev_tasks',
    'dispatch_dev_task',
    'attach_dev_task_session',
    'get_latest_campaign_pulse',
    'get_campaign_alerts',
    'list_my_agent_tasks',
    'get_execution_goal_report',
    'record_action_episode',
    'toggle_facebook_campaign',
    'execute_pending_approval'
  ]::text[],
  system_prompt = system_prompt || E'\n\nClient 360: for a specific client use get_client_operations_package before proposing action. Summarize summary.open_recommendation_count and lead with critical items. Mutating Meta — toggle_facebook_campaign / budget tools only via execute_pending_approval after David approves.',
  updated_at = now()
WHERE tenant_id = '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'
  AND slug = 'carmen_operations_control_layer'
  AND scope = 'tenant';
