-- claude_notify_david — guaranteed WhatsApp update channel from Claude to David.
--
-- A Claude routine session finishing a Carmen-delegated task calls this from its
-- Supabase connector (execute_sql) to push a message straight to David's
-- WhatsApp, independent of any live Carmen session:
--   select public.claude_notify_david('done: <summary> <PR link>');
--
-- It reads the shared bearer from Vault (secret name 'claude_mcp_bearer') and
-- POSTs to the claude-notify edge function, which sends through the tenant's
-- Carmen WhatsApp automation. The bearer never appears in any prompt/transcript.
--
-- NOTE: the Vault secret itself is created out-of-band (it holds CLAUDE_MCP_BEARER)
-- and is intentionally NOT in this migration.

create or replace function public.claude_notify_david(
  p_message text,
  p_tenant uuid default '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019',
  p_chat_id text default null
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $func$
declare
  v_bearer text;
  v_req bigint;
begin
  select decrypted_secret into v_bearer
  from vault.decrypted_secrets where name = 'claude_mcp_bearer' limit 1;

  select net.http_post(
    url := 'https://zvoijyneresvkadpprel.supabase.co/functions/v1/claude-notify',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce(v_bearer, '')
    ),
    body := jsonb_build_object('tenant_id', p_tenant::text, 'message', p_message)
            || case when p_chat_id is not null then jsonb_build_object('chat_id', p_chat_id) else '{}'::jsonb end
  ) into v_req;

  return jsonb_build_object('queued', true, 'request_id', v_req);
end;
$func$;

grant execute on function public.claude_notify_david(text, uuid, text) to authenticated, service_role, anon;
