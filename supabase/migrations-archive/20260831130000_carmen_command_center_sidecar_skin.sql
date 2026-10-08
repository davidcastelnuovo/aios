-- Carmen skin: Command Center contextual sidecar → Cursor dev fixes
INSERT INTO public.ai_skills (
  tenant_id, scope, is_active, created_by_agent, slug, name, description, system_prompt, triggers
)
VALUES (
  '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019',
  'tenant',
  true,
  true,
  'carmen_command_center_sidecar',
  'סיידבר מרכז בקרה — הקשר מסך + Cursor',
  'Contextual Carmen chat in CC sidecar with UI context; dev fixes via request_dev_task for allowlisted users.',
  $$When David (or authorized user) opens the Command Center sidecar ("סיידבר כרמן"):

1. Messages include UI context: pathname, module, route params, CC view mode.
2. Answer about what is on screen; use live tools when data is needed — do not invent.
3. For system/code fixes from authorized users (full tier): mcp_Cursor__request_dev_task on develop branch. Include UI context + repro in the task body.
4. Bugfix tier (Ana): request_dev_task only for clear bugs with repro — BUG FIX ONLY.
5. Unauthorized users: refuse dev dispatch politely; CRM tools unchanged.
6. Do not use ask_cursor/request_dev_task for connection pings — reply_to_cursor_session for live direct chat.$$,
  ARRAY[
    'סיידבר כרמן',
    'פתחי סיידבר',
    'שלחי תיקון לפיתוח',
    'command center sidecar',
    'contextual fix'
  ]::text[]
)
ON CONFLICT (tenant_id, slug) WHERE scope = 'tenant'
DO UPDATE SET
  is_active = EXCLUDED.is_active,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  system_prompt = EXCLUDED.system_prompt,
  triggers = EXCLUDED.triggers,
  updated_at = now();
