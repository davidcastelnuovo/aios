// Carmen Approval Execute — runs a pending row from agent_approval_queue.
// Routes to carmen-fb-tools / carmen-google-tools / carmen-save-media based on tool_name.
// Used by run-ai-agent (when Carmen calls execute_pending_approval) and by campaign-scheduler-cron.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

const SB_URL = Deno.env.get('SUPABASE_URL')!;
const SB_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const TOOL_TO_FUNCTION: Record<string, { fn: string; action?: string }> = {
  fb_create_campaign: { fn: 'carmen-fb-tools', action: 'create_campaign' },
  fb_create_adset: { fn: 'carmen-fb-tools', action: 'create_adset' },
  fb_create_ad: { fn: 'carmen-fb-tools', action: 'create_ad' },
  fb_create_creative_from_media: { fn: 'carmen-fb-tools', action: 'create_creative_from_media' },
  fb_replace_lead_form: { fn: 'carmen-fb-tools', action: 'replace_lead_form' },
  fb_update_budget: { fn: 'carmen-fb-tools', action: 'update_budget' },
  fb_pause: { fn: 'carmen-fb-tools', action: 'pause' },
  fb_resume: { fn: 'carmen-fb-tools', action: 'resume' },
  gads_pause: { fn: 'carmen-google-tools', action: 'pause' },
  gads_resume: { fn: 'carmen-google-tools', action: 'resume' },
  gads_update_budget: { fn: 'carmen-google-tools', action: 'update_budget' },
};

async function invokeEdgeFn(name: string, payload: any) {
  const r = await fetch(`${SB_URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SB_SERVICE}`,
      'Content-Type': 'application/json',
      'apikey': SB_SERVICE,
    },
    body: JSON.stringify(payload),
  });
  const json = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, json };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const supabase = createClient(SB_URL, SB_SERVICE);
    const body = await req.json().catch(() => ({}));
    const { approval_id, approved_by } = body;
    if (!approval_id) return new Response(JSON.stringify({ error: 'approval_id required' }), { status: 400, headers: corsHeaders });

    const { data: row, error } = await supabase.from('agent_approval_queue').select('*').eq('id', approval_id).maybeSingle();
    if (error || !row) return new Response(JSON.stringify({ error: 'approval_not_found' }), { status: 404, headers: corsHeaders });
    if (row.status === 'executed') return new Response(JSON.stringify({ success: true, already_executed: true, result: row.execution_result }), { headers: corsHeaders });
    if (row.status === 'rejected') return new Response(JSON.stringify({ error: 'rejected' }), { status: 400, headers: corsHeaders });

    const route = TOOL_TO_FUNCTION[row.tool_name];
    if (!route) return new Response(JSON.stringify({ error: 'unknown_tool', tool_name: row.tool_name }), { status: 400, headers: corsHeaders });

    const payload = {
      tenant_id: row.tenant_id,
      action: route.action,
      confirmed: true,
      ...((row.tool_input as any) || {}),
    };

    const r = await invokeEdgeFn(route.fn, payload);

    await supabase.from('agent_approval_queue').update({
      status: r.ok ? 'executed' : 'failed',
      approved_by: approved_by || row.requested_by,
      approved_at: row.approved_at || new Date().toISOString(),
      executed_at: new Date().toISOString(),
      execution_result: r.json,
    }).eq('id', approval_id);

    return new Response(JSON.stringify({ success: r.ok, result: r.json, approval_id }), { status: r.ok ? 200 : 400, headers: corsHeaders });
  } catch (e: any) {
    console.error('[carmen-approval-execute]', e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500, headers: corsHeaders });
  }
});
