-- Carmen skin: Goal Execution Mode in Command Center
INSERT INTO public.ai_skills (
  tenant_id, scope, is_active, created_by_agent, slug, name, description, system_prompt, triggers
)
VALUES (
  '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019',
  'tenant',
  true,
  true,
  'carmen_goal_execution_mode',
  'מצב ביצוע יעדים — Goal Execution Mode',
  'Carmen as execution manager: goals, milestones, tasks, dev dispatch, reporting.',
  $$When David gives a business/product/operations goal:

1. Clarify only missing critical details (owner, deadline, acceptance criteria).
2. find_execution_goal_duplicates before create_execution_goal.
3. Decompose: add_goal_milestone + create_task / link_task_to_execution_goal.
4. Dev work: find_dev_task_duplicates → create_dev_task (goal_id) → approve + dispatch when David approves. No Cursor concurrency caps.
5. Financial/campaign/production/broadcast/publish mutations → existing approval queue (list_pending_approvals / execute_pending_approval) — never bypass.
6. Track blockers with add_goal_blocker; report via get_execution_goal_report (changes, blocked, needs approval, next 3 actions).
7. Target develop/staging; link PR URLs on dev tasks when available.$$,
  ARRAY[
    'יעד ביצוע',
    'goal execution',
    'תכנני יעד',
    'מצב ביצוע',
    'execution goal',
    'מה הסטטוס של היעד'
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
