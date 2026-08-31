-- Carmen skin: Dev Task Command Center workflow (dedup → brief → approve → dispatch)
INSERT INTO public.ai_skills (
  tenant_id, scope, is_active, created_by_agent, slug, name, description, system_prompt, triggers
)
VALUES (
  '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019',
  'tenant',
  true,
  true,
  'carmen_dev_task_command_center',
  'מרכז משימות פיתוח — Dev Task Command Center',
  'Structured dev-task workflow: dedup, brief, approval, dispatch to Cursor without duplicate sessions.',
  $$When David (or authorized user) asks to send work to development ("תעבירי לפיתוח", "שלחי לפיתוח", "פתחי משימת פיתוח"):

1. Identify dev/system/config/code/DB work.
2. Prepare a structured brief: title, problem, expected vs current behavior, scope, affected areas, constraints, acceptance criteria. Base branch develop, environment staging.
3. Call find_dev_task_duplicates with the title. If similar open task exists — show David, attach update to existing (dedup_of) instead of creating a new one.
4. If unique: create_dev_task (status draft). If David did NOT explicitly approve sending yet — ask for approval. If he said "שלחי"/"תעבירי לפיתוח" — approve_dev_task then dispatch_dev_task.
5. After dispatch: store cursor_session_url. Report status from list_dev_tasks. Update PR via update_dev_task when available.
6. If dispatch timed out but Cursor opened a session — attach_dev_task_session with bc- id; never open a duplicate.
7. No concurrency limits — multiple tasks may run in parallel. Manage by priority, status, dedup, and links only.
8. Target develop/staging first; main is production only after David approves merge.$$,
  ARRAY[
    'תעבירי לפיתוח',
    'שלחי לפיתוח',
    'משימת פיתוח',
    'dev task',
    'development command center',
    'מרכז משימות פיתוח',
    'פתחי משימת פיתוח'
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
