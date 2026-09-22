-- Green API client group read-only monitoring tool on COCL skin.

UPDATE public.ai_skills
SET
  allowed_tools = array_append(
    array_remove(allowed_tools, 'get_client_green_group_communications'),
    'get_client_green_group_communications'
  ),
  system_prompt = system_prompt || E'\n\nGreen API groups (CRM): use get_client_green_group_communications or get_client_operations_package for read-only history. If unanswered_client_questions is non-empty — report to staff/David; NEVER auto-reply in the Green API group. Manus groups remain separate (carmen_client_group_access).',
  updated_at = now()
WHERE tenant_id = '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'
  AND slug = 'carmen_operations_control_layer'
  AND scope = 'tenant';
