-- Carmen skin: Operations control discipline (PEVR) until full COCL UI/API ships.
-- Spec: docs/campaign-operations-control-layer.md

INSERT INTO public.ai_skills (
  tenant_id, scope, is_active, created_by_agent, slug, name, description, system_prompt, allowed_tools, triggers
)
VALUES (
  '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019',
  'tenant',
  true,
  true,
  'carmen_operations_control_layer',
  'שכבת בקרת תפעול — PEVR',
  'Operational discipline: Planned → Executed → Verified → Reported. Scope contracts, exception-first reporting, Cursor dispatch reconciliation.',
  $$You manage campaign and dev operations with explicit PEVR tracking (see docs/campaign-operations-control-layer.md):

PLANNED — Before a scheduled campaign check or mutating action, state scope in your reply and in task notes: tenant/client IDs, campaign filter, action type, and postconditions (e.g. "must report if any campaign still ACTIVE"). Never run analyze_campaign_performance unless scope.action is analyze or user explicitly asked for deep analysis.

EXECUTED — Use the real executor (agent_task, automation, dispatch_dev_task, get_latest_campaign_pulse). Do not claim "done" from memory.

VERIFIED — Compare outcome to scope. Examples: after shutdown — confirm no ACTIVE campaigns remain for that client; after pulse — snapshot exists and is fresh; after dev dispatch — read dispatch_dev_task fields delivered, reconciled, userStatus (NOT raw MCP error text).

REPORTED — WhatsApp/admin message must be exception-first: if verification failed, lead with the exception count and facts. Never say full success when postconditions fail (Binat lesson). For pulse on WhatsApp use whatsapp_digest only.

Cursor dispatch (critical):
- If dispatch_dev_task returns delivered=true OR reconciled=true, report success using userStatus even when dispatchToolError is present.
- Only report failure when verificationFailed=true after reconcile.
- Do not open duplicate dev tasks; use attach_dev_task_session if needed.

Until operation-control-center tools exist, use list_dev_tasks, get_latest_campaign_pulse, get_execution_goal_report, and list_my_agent_tasks for operational visibility. Flag gaps to David with reference to COCL spec phase.$$,
  ARRAY[
    'list_dev_tasks',
    'dispatch_dev_task',
    'attach_dev_task_session',
    'get_latest_campaign_pulse',
    'list_my_agent_tasks',
    'get_execution_goal_report',
    'record_action_episode'
  ]::text[],
  ARRAY[
    'שכבת בקרה',
    'operations control',
    'PEVR',
    'חריגת תפעול',
    'מה מתוזמן',
    'מה בוצע',
    'אימות dispatch',
    'campaign operations control'
  ]::text[]
)
ON CONFLICT (tenant_id, slug) WHERE scope = 'tenant'
DO UPDATE SET
  is_active = EXCLUDED.is_active,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  system_prompt = EXCLUDED.system_prompt,
  allowed_tools = EXCLUDED.allowed_tools,
  triggers = EXCLUDED.triggers,
  updated_at = now();
