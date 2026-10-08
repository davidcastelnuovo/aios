-- ai_agents & agent_mcp_connections had RLS enabled but ZERO policies, so the
-- Carmen Studio screens (Core + Access) — which read these tables directly with
-- the authenticated user JWT — saw nothing ("create an agent first" / empty Core).
-- Grant tenant-scoped access, mirroring the ai_skills fix.

-- ai_agents: tenant members manage their own agents (Carmen). No secret columns.
DROP POLICY IF EXISTS ai_agents_tenant_rw ON public.ai_agents;
CREATE POLICY ai_agents_tenant_rw ON public.ai_agents
  FOR ALL TO authenticated
  USING (tenant_id = public.get_effective_tenant_id() OR public.is_super_admin(auth.uid()))
  WITH CHECK (tenant_id = public.get_effective_tenant_id() OR public.is_super_admin(auth.uid()));

-- agent_mcp_connections: read-only for the tenant, but oauth_tokens & client_metadata
-- must NEVER reach the browser. Column-level grant keeps those service-role only.
REVOKE SELECT ON public.agent_mcp_connections FROM authenticated;
GRANT SELECT (id, tenant_id, agent_id, name, url, transport, state, available_tools, last_error, created_at, updated_at)
  ON public.agent_mcp_connections TO authenticated;

DROP POLICY IF EXISTS agent_mcp_connections_tenant_read ON public.agent_mcp_connections;
CREATE POLICY agent_mcp_connections_tenant_read ON public.agent_mcp_connections
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_effective_tenant_id() OR public.is_super_admin(auth.uid()));
