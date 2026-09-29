-- COCL Phase 1a: operation plans, runs, PEVR audit (Staging first).

CREATE TABLE IF NOT EXISTS public.operation_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  slug text NOT NULL,
  name text NOT NULL,
  operation_type text NOT NULL
    CHECK (operation_type IN (
      'campaign_action', 'pulse_check', 'report_delivery', 'dev_dispatch', 'custom_agent_task', 'client_ops_scan'
    )),
  scope_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  schedule_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  approval_policy text NOT NULL DEFAULT 'none'
    CHECK (approval_policy IN ('none', 'human_required', 'reuse_agent_approval_queue')),
  reporting_policy jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_operation_plans_tenant_slug
  ON public.operation_plans (tenant_id, slug);

CREATE TABLE IF NOT EXISTS public.operation_scope_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  scope_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.operation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.operation_plans(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'planned'
    CHECK (status IN (
      'planned', 'scheduled', 'running', 'executed', 'failed', 'verifying', 'verified',
      'exception', 'reporting', 'reported', 'report_failed', 'reconciling', 'closed'
    )),
  rollup_status text NOT NULL DEFAULT 'on_track'
    CHECK (rollup_status IN ('on_track', 'needs_attention', 'complete')),
  planned_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz,
  trigger_source text NOT NULL DEFAULT 'manual_ui'
    CHECK (trigger_source IN ('scheduler', 'carmen_tool', 'automation', 'manual_ui', 'executor')),
  executor_ref jsonb,
  scope_snapshot_id uuid REFERENCES public.operation_scope_snapshots(id) ON DELETE SET NULL,
  verification_status text NOT NULL DEFAULT 'pending'
    CHECK (verification_status IN ('pending', 'passed', 'failed', 'skipped')),
  exception_count integer NOT NULL DEFAULT 0,
  idempotency_key text,
  title text,
  summary text,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  dev_task_id uuid REFERENCES public.dev_tasks(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_operation_runs_idempotency
  ON public.operation_runs (tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_operation_runs_tenant_status_planned
  ON public.operation_runs (tenant_id, status, planned_at DESC);

CREATE INDEX IF NOT EXISTS idx_operation_runs_tenant_rollup
  ON public.operation_runs (tenant_id, rollup_status, planned_at DESC);

CREATE TABLE IF NOT EXISTS public.operation_run_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  operation_run_id uuid NOT NULL REFERENCES public.operation_runs(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_operation_run_events_run
  ON public.operation_run_events (operation_run_id, created_at ASC);

CREATE TABLE IF NOT EXISTS public.operation_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  operation_run_id uuid NOT NULL REFERENCES public.operation_runs(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'passed', 'failed', 'skipped')),
  checks jsonb NOT NULL DEFAULT '[]'::jsonb,
  summary text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_operation_verifications_run
  ON public.operation_verifications (operation_run_id);

CREATE TABLE IF NOT EXISTS public.operation_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  operation_run_id uuid NOT NULL REFERENCES public.operation_runs(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('whatsapp', 'command_center', 'email')),
  recipient_ref text,
  body_digest text,
  full_payload_ref text,
  delivery_status text NOT NULL DEFAULT 'pending',
  idempotency_key text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_operation_reports_run
  ON public.operation_reports (operation_run_id, created_at DESC);

-- RLS (tenant_users — production pattern)
ALTER TABLE public.operation_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operation_scope_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operation_run_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operation_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operation_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY operation_plans_tenant ON public.operation_plans
  FOR ALL
  USING (tenant_id IN (SELECT tu.tenant_id FROM public.tenant_users tu WHERE tu.user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tu.tenant_id FROM public.tenant_users tu WHERE tu.user_id = auth.uid()));

CREATE POLICY operation_scope_snapshots_tenant ON public.operation_scope_snapshots
  FOR ALL
  USING (tenant_id IN (SELECT tu.tenant_id FROM public.tenant_users tu WHERE tu.user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tu.tenant_id FROM public.tenant_users tu WHERE tu.user_id = auth.uid()));

CREATE POLICY operation_runs_tenant ON public.operation_runs
  FOR ALL
  USING (tenant_id IN (SELECT tu.tenant_id FROM public.tenant_users tu WHERE tu.user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tu.tenant_id FROM public.tenant_users tu WHERE tu.user_id = auth.uid()));

CREATE POLICY operation_run_events_tenant ON public.operation_run_events
  FOR SELECT
  USING (tenant_id IN (SELECT tu.tenant_id FROM public.tenant_users tu WHERE tu.user_id = auth.uid()));

CREATE POLICY operation_verifications_tenant ON public.operation_verifications
  FOR SELECT
  USING (tenant_id IN (SELECT tu.tenant_id FROM public.tenant_users tu WHERE tu.user_id = auth.uid()));

CREATE POLICY operation_reports_tenant ON public.operation_reports
  FOR SELECT
  USING (tenant_id IN (SELECT tu.tenant_id FROM public.tenant_users tu WHERE tu.user_id = auth.uid()));

CREATE POLICY operation_plans_service ON public.operation_plans FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY operation_scope_snapshots_service ON public.operation_scope_snapshots FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY operation_runs_service ON public.operation_runs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY operation_run_events_service ON public.operation_run_events FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY operation_verifications_service ON public.operation_verifications FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY operation_reports_service ON public.operation_reports FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON TABLE public.operation_runs IS 'COCL PEVR run instances — authoritative operational status per docs/campaign-operations-control-layer.md';
