// carmen-activate-phone — sends a one-time "you were authorized" activation
// message to a newly allow-listed phone, so that the person's REPLY teaches
// wa_lid_map their anonymous WhatsApp LID (see the activation matcher in
// manus-wa-webhook). This closes the LID gap end-to-end: adding a phone to
// carmen_allowed_phones fires a Postgres trigger → carmen_send_activation()
// (SECURITY DEFINER) → this function → WhatsApp message with a one-time code.
// The reply with that code (or a quoted reply) maps LID→phone permanently.
//
// Auth: Authorization: Bearer == CLAUDE_MCP_BEARER (same shared secret as
// claude-notify / claude-mcp). Called from Postgres via pg_net, so the secret
// never leaves the Vault/env boundary.
//
// Body: { activation_id, tenant_id, phone, code, integration_id? }
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CLAUDE_MCP_BEARER = Deno.env.get('CLAUDE_MCP_BEARER') || '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const auth = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!CLAUDE_MCP_BEARER || auth !== CLAUDE_MCP_BEARER) return json({ error: 'unauthorized' }, 401);

  const { activation_id, tenant_id, integration_id, phone, code } = await req.json().catch(() => ({}));
  if (!tenant_id || !phone || !code) return json({ error: 'missing tenant_id/phone/code' }, 400);

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Resolve the sending integration: the automation's pinned one, else the
  // tenant's active manus_wa integration (Carmen's own number).
  let integ: { id: string; user_id: string } | null = null;
  if (integration_id) {
    const { data } = await sb.from('tenant_integrations')
      .select('id, user_id').eq('id', integration_id).maybeSingle();
    if (data) integ = data as any;
  }
  if (!integ) {
    const { data } = await sb.from('tenant_integrations')
      .select('id, user_id')
      .eq('tenant_id', tenant_id).eq('integration_type', 'manus_wa').eq('is_active', true)
      .order('updated_at', { ascending: false }).limit(1).maybeSingle();
    if (data) integ = data as any;
  }
  if (!integ) return json({ error: 'no active manus_wa integration for tenant' }, 404);

  const message = `היי 👋 המספר שלך הוגדר כמורשה לשוחח עם כרמן.\nכדי שאזהה אותך, השב להודעה זו עם הקוד: ${code}`;
  const res = await fetch(`${SUPABASE_URL}/functions/v1/send-manus-wa-message`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({
      integrationId: integ.id,
      tenantId: tenant_id,
      phoneNumber: phone,
      senderUserId: integ.user_id,
      message,
    }),
  });
  const outText = await res.text();
  console.log('[carmen-activate-phone] sent', { tenant_id, phone, status: res.status });

  // Best effort: record the gateway message id so a quoted reply also matches.
  if (activation_id) {
    try {
      const parsed = JSON.parse(outText);
      const mid = parsed?.messageId || parsed?.id || parsed?.data?.messageId || parsed?.result?.messageId || null;
      if (mid) {
        await sb.from('wa_pending_activations')
          .update({ activation_message_id: String(mid) })
          .eq('id', activation_id);
      }
    } catch (_) { /* non-JSON response — code matching still works */ }
  }

  return json({ ok: res.ok, send_status: res.status });
});
