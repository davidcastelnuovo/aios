-- Client Operations Intelligence (Phase 2c): proactive recommendations per client.

CREATE TABLE IF NOT EXISTS public.client_operation_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  recommendation_type text NOT NULL
    CHECK (recommendation_type IN (
      'contact_client', 'handle_critical_alert', 'review_pulse', 'optimize_campaigns',
      'pause_campaigns', 'notify_staff', 'custom'
    )),
  severity text NOT NULL DEFAULT 'info'
    CHECK (severity IN ('info', 'warning', 'critical')),
  title text NOT NULL,
  body text,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'accepted', 'dismissed', 'resolved')),
  requires_approval boolean NOT NULL DEFAULT false,
  suggested_tool text,
  fingerprint text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.client_operation_recommendations IS
  'Rule-based proactive ops suggestions for Carmen (Client 360). Mutating actions still require agent_approval_queue.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_client_op_rec_open_fingerprint
  ON public.client_operation_recommendations (tenant_id, client_id, fingerprint)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS idx_client_op_rec_tenant_client_status
  ON public.client_operation_recommendations (tenant_id, client_id, status, updated_at DESC);

ALTER TABLE public.client_operation_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY client_op_rec_tenant_rw ON public.client_operation_recommendations
  FOR ALL
  USING (
    tenant_id IN (SELECT tm.tenant_id FROM public.tenant_members tm WHERE tm.user_id = auth.uid())
  )
  WITH CHECK (
    tenant_id IN (SELECT tm.tenant_id FROM public.tenant_members tm WHERE tm.user_id = auth.uid())
  );

CREATE POLICY client_op_rec_service ON public.client_operation_recommendations
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
