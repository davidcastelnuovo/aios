-- Client Ops Signal → Playbook framework (general, tenant-configurable).

CREATE TABLE IF NOT EXISTS public.client_ops_playbooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  signal_kind text NOT NULL,
  name text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  auto_execute boolean NOT NULL DEFAULT false,
  assignee_policy jsonb NOT NULL DEFAULT '{"strategy":"client_primary_campaigner"}'::jsonb,
  task_template jsonb NOT NULL DEFAULT '{}'::jsonb,
  verification_plan jsonb NOT NULL DEFAULT '[]'::jsonb,
  carmen_guidance text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, signal_kind)
);

COMMENT ON TABLE public.client_ops_playbooks IS
  'Maps operational signal_kind → task assignee, templates, verification checklist (docs/client-ops-signal-framework.md).';

ALTER TABLE public.client_operation_recommendations
  ADD COLUMN IF NOT EXISTS signal_kind text,
  ADD COLUMN IF NOT EXISTS problem_summary text,
  ADD COLUMN IF NOT EXISTS assignee_policy jsonb,
  ADD COLUMN IF NOT EXISTS verification_plan jsonb,
  ADD COLUMN IF NOT EXISTS linked_task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_verification_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_verification_result jsonb;

CREATE INDEX IF NOT EXISTS idx_client_op_rec_signal
  ON public.client_operation_recommendations (tenant_id, signal_kind, status);

ALTER TABLE public.client_ops_playbooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY client_ops_playbooks_tenant ON public.client_ops_playbooks
  FOR ALL
  USING (tenant_id IN (SELECT tu.tenant_id FROM public.tenant_users tu WHERE tu.user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tu.tenant_id FROM public.tenant_users tu WHERE tu.user_id = auth.uid()));

CREATE POLICY client_ops_playbooks_service ON public.client_ops_playbooks
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Default playbooks for AIOS tenant (override assignee in UI/SQL per org).
INSERT INTO public.client_ops_playbooks (
  tenant_id, signal_kind, name, auto_execute, assignee_policy, task_template, verification_plan, carmen_guidance
) VALUES
(
  '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019',
  'comms.group_client_unanswered',
  'שאלת לקוח בקבוצה — SLA',
  true,
  '{"strategy":"client_primary_campaigner"}'::jsonb,
  '{"title":"{{client_name}}: {{problem_summary}}","notes":"{{problem_detail}}\n\nבדיקות: לענות בקבוצה (Green), לוודא שהנושא טופל, לעדכן כרטיס אם נדרש."}'::jsonb,
  '[{"id":"group_reply","type":"green_group_reply_after","params":{"message_at_field":"message_at"}},{"id":"pulse","type":"pulse_status","params":{"max_status":"warning"}}]'::jsonb,
  'הביני מה הלקוח שאל; אם זה ביצועים/המרות — בדקי דופק ו-get_latest_campaign_pulse לפני מענה.'
),
(
  '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019',
  'comms.group_staff_commitment_unfulfilled',
  'התחייבות צוות בקבוצה',
  true,
  '{"strategy":"client_primary_campaigner"}'::jsonb,
  '{"title":"{{client_name}}: מעקב — {{problem_summary}}","notes":"{{problem_detail}}\n\nמקור: קבוצת Green API (קריאה בלבד)."}'::jsonb,
  '[{"id":"group_done","type":"green_group_commitment_closed","params":{"message_at_field":"message_at"}},{"id":"task_open","type":"open_task_exists","params":{}}]'::jsonb,
  'אל תשלחי לקבוצה; פתחי/עקבי משימה פנימית עד שיש סגירה בקבוצה או בכרטיס.'
),
(
  '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019',
  'comms.card_weekly_missing_from_group',
  'עדכון שבועי בקבוצה — חסר בכרטיס',
  false,
  '{"strategy":"client_primary_campaigner"}'::jsonb,
  '{"title":"{{client_name}}: לסנכרן עדכון שבועי לכרטיס","notes":"{{problem_detail}}"}'::jsonb,
  '[{"id":"card_weekly","type":"client_weekly_update_since","params":{"days":7}}]'::jsonb,
  'העדיפי sync_weekly_update_from_green_group לפני משימה ידנית.'
),
(
  '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019',
  'performance.critical_campaign_alert',
  'התראת קמפיין קריטית',
  false,
  '{"strategy":"client_primary_campaigner"}'::jsonb,
  '{"title":"{{client_name}}: {{problem_summary}}","notes":"{{problem_detail}}"}'::jsonb,
  '[{"id":"alerts","type":"critical_alerts_cleared","params":{}}]'::jsonb,
  'אין mutate ב-Meta בלי אישור.'
),
(
  '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019',
  'performance.pulse_degraded',
  'דופק degraded',
  false,
  '{"strategy":"client_primary_campaigner"}'::jsonb,
  '{"title":"{{client_name}}: {{problem_summary}}","notes":"{{problem_detail}}"}'::jsonb,
  '[{"id":"pulse","type":"pulse_status","params":{"max_status":"ok"}}]'::jsonb,
  'get_latest_campaign_pulse — לא analyze אוטומטי.'
),
(
  '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019',
  'relationship.client_call_stale',
  'שיחת לקוח לא מתועדת',
  false,
  '{"strategy":"client_primary_campaigner"}'::jsonb,
  '{"title":"{{client_name}}: {{problem_summary}}","notes":"{{problem_detail}}"}'::jsonb,
  '[{"id":"call","type":"client_call_logged_since","params":{"days":14}}]'::jsonb,
  'תאמי שיחה או רשמי call בכרטיס.'
)
ON CONFLICT (tenant_id, signal_kind) DO UPDATE SET
  name = EXCLUDED.name,
  auto_execute = EXCLUDED.auto_execute,
  assignee_policy = EXCLUDED.assignee_policy,
  task_template = EXCLUDED.task_template,
  verification_plan = EXCLUDED.verification_plan,
  carmen_guidance = EXCLUDED.carmen_guidance,
  updated_at = now();
