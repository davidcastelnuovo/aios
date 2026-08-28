-- Staging Carmen Cursor MCP was cloned from prod: URL still pointed at
-- production cursor-mcp while oauth_tokens.bearer was the staging
-- CURSOR_MCP_BEARER → 401. Repoint to this project's cursor-mcp.
-- Bearer copy is done by mcp-connect {resync_from_secret:true} so the secret
-- never appears in SQL.

UPDATE public.agent_mcp_connections
SET url = 'https://mzjsuvatrzhciojmbbbm.supabase.co/functions/v1/cursor-mcp',
    last_error = null,
    updated_at = now()
WHERE id = '5c6a37d2-2394-4364-be99-883a326f72cd'::uuid
  AND tenant_id = '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'::uuid
  AND name = 'Cursor'
  AND url LIKE '%zvoijyneresvkadpprel%cursor-mcp%';
