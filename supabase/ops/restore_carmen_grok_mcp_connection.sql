-- Carmen could not find Grok Bot from Command Center:
-- 1) The only ready grok-mcp row was named GROK_MCP_BEARER, so tools were
--    mcp_GROK_MCP_BEARER__* instead of mcp_Grok__* (skins + escalation filter).
-- 2) Failed "Grok" reconnect attempts (401 / missing bearer) cluttered the list.
-- 3) ai_agents.metadata.escalation_agent = 'cursor' hides mcp_Grok__ tools.
-- Does not copy secrets. Does not touch Cursor or Grok Bot plugin bearers.

DELETE FROM public.agent_mcp_connections
WHERE tenant_id = '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'::uuid
  AND agent_id = '8cdb9373-a370-4ae4-8e90-b5a7c35ab492'::uuid
  AND name = 'Grok'
  AND state = 'failed';

UPDATE public.agent_mcp_connections
SET name = 'Grok',
    last_error = null,
    updated_at = now()
WHERE id = '7c0b07dd-4403-48c3-948c-f9581e3654f8'::uuid
  AND tenant_id = '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'::uuid
  AND name = 'GROK_MCP_BEARER'
  AND state = 'ready';

UPDATE public.ai_agents
SET metadata = jsonb_set(coalesce(metadata, '{}'::jsonb), '{escalation_agent}', '"all"'::jsonb, true),
    updated_at = now()
WHERE id = '8cdb9373-a370-4ae4-8e90-b5a7c35ab492'::uuid
  AND tenant_id = '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'::uuid
  AND coalesce(metadata->>'escalation_agent', '') = 'cursor';

INSERT INTO public.claude_carmen_audit (tenant_id, actor, action, target, details)
VALUES (
  '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'::uuid,
  'claude',
  'restore_carmen_grok_mcp_connection',
  'agent_mcp_connections:7c0b07dd-4403-48c3-948c-f9581e3654f8',
  jsonb_build_object(
    'renamed', 'GROK_MCP_BEARER → Grok',
    'escalation_agent', 'cursor → all (so mcp_Grok__ is not filtered away)',
    'deleted_failed_grok_rows', true
  )
);
