-- Carmen dev-task skin: expose native workflow tools when trigger matches (WhatsApp + CC).
UPDATE public.ai_skills
SET
  allowed_tools = ARRAY[
    'find_dev_task_duplicates',
    'create_dev_task',
    'approve_dev_task',
    'dispatch_dev_task',
    'list_dev_tasks',
    'update_dev_task',
    'attach_dev_task_session',
    'mcp_Cursor__request_dev_task'
  ]::text[],
  updated_at = now()
WHERE slug = 'carmen_dev_task_command_center'
  AND scope = 'tenant';
