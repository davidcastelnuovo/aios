-- Audit only. The actual bearer copy is done by mcp-connect {resync_from_secret:true}
-- so the secret never appears in SQL/git. Applied after a successful resync.

INSERT INTO public.claude_carmen_audit (tenant_id, actor, action, target, details)
VALUES (
  '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'::uuid,
  'claude',
  'resync_carmen_cursor_mcp_bearer',
  'agent_mcp_connections:5c6a37d2-2394-4364-be99-883a326f72cd',
  jsonb_build_object(
    'reason', 'CURSOR_MCP_BEARER was rotated 2026-08-27 when Grok Direct was connected; Carmen Cursor row still had the old bearer',
    'result', 'copied current CURSOR_MCP_BEARER onto Carmen Cursor MCP connection and re-probed tools/list',
    'grok_untouched', true
  )
);
