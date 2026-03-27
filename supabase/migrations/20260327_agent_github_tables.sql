-- Approval queue for sensitive agent actions
CREATE TABLE IF NOT EXISTS agent_approval_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES ai_agents(id),
  requested_by UUID, -- user who triggered the action
  action_type TEXT NOT NULL, -- 'code_fix', 'permission_change', 'config_change'
  title TEXT NOT NULL,
  description TEXT,
  context JSONB, -- full context: error, file, user info, etc.
  proposed_changes JSONB, -- what the agent wants to do
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'executed'
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  execution_result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Agent credentials (GitHub tokens, etc.) stored securely per tenant
CREATE TABLE IF NOT EXISTS agent_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  credential_type TEXT NOT NULL, -- 'github_token', 'claude_api_key'
  credential_name TEXT NOT NULL,
  encrypted_value TEXT NOT NULL, -- stored encrypted
  metadata JSONB, -- e.g. { repo: "owner/repo", permissions: ["contents", "pull_requests"] }
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, credential_type, credential_name)
);

-- Agent action log
CREATE TABLE IF NOT EXISTS agent_action_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES ai_agents(id),
  action_type TEXT NOT NULL,
  action_details JSONB NOT NULL,
  status TEXT NOT NULL, -- 'success', 'error', 'pending_approval'
  error_message TEXT,
  user_id UUID, -- user who triggered
  conversation_id UUID, -- link to chat conversation
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_approval_queue_tenant_status ON agent_approval_queue(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_agent_action_log_tenant ON agent_action_log(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_credentials_tenant ON agent_credentials(tenant_id);

-- RLS
ALTER TABLE agent_approval_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_action_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_approval_select" ON agent_approval_queue FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));
CREATE POLICY "agent_approval_insert" ON agent_approval_queue FOR INSERT WITH CHECK (true);
CREATE POLICY "agent_approval_update" ON agent_approval_queue FOR UPDATE USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));
CREATE POLICY "agent_credentials_select" ON agent_credentials FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));
CREATE POLICY "agent_credentials_insert" ON agent_credentials FOR INSERT WITH CHECK (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));
CREATE POLICY "agent_credentials_update" ON agent_credentials FOR UPDATE USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));
CREATE POLICY "agent_credentials_delete" ON agent_credentials FOR DELETE USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));
CREATE POLICY "agent_action_log_select" ON agent_action_log FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));
CREATE POLICY "agent_action_log_insert" ON agent_action_log FOR INSERT WITH CHECK (true);
