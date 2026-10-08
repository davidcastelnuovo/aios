-- Teach Carmen to look up Cursor sessions by task (post-deploy).

INSERT INTO public.ai_skills (
  tenant_id, scope, slug, name, description, is_active, created_by_agent,
  trigger_phrases, steps, system_prompt, constraints
)
SELECT
  '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'::uuid,
  'tenant',
  'cursor_task_session_lookup',
  'מצא סשן Cursor לפי משימה',
  'Lookup tracked Cursor Cloud Agent bc-… sessions by human task id — no fixed session id.',
  true,
  true,
  ARRAY[
    'איזה סשן קרסר למשימה',
    'cursor session for task',
    'פתחי את הסשן של המשימה בקרסר',
    'list cursor sessions'
  ],
  $$1. לפי task_id: mcp_Cursor__get_cursor_task_session({ task_id }).
2. לרשימת פעילים: mcp_Cursor__list_cursor_task_sessions({ status: "active" }).
3. לענות בצ'אט קיים: mcp_Cursor__reply_to_cursor_session({ session_id, message }) עם ה-bc מהשלב הקודם.
4. משימת פיתוח חדשה: request_dev_task (יוצר bc חדש ונרשם אוטומטית).$$,
  $$Use get_cursor_task_session / list_cursor_task_sessions before inventing bc ids.
reply_to_cursor_session for follow-ups into an existing tracked session.
request_dev_task only for new implementation work.$$,
  'לא להמציא bc-. לא לבקש מזהה קבוע ישן.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ai_skills
  WHERE slug = 'cursor_task_session_lookup'
    AND tenant_id = '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'::uuid
);
