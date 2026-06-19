// Updates Facebook campaign budget or duplicates a campaign. Write ops with audit log.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

async function getFbToken(supabase: any, tenant_id: string): Promise<string | null> {
  let { data: integ } = await supabase
    .from('tenant_integrations')
    .select('api_key, shared_from_integration_id')
    .eq('tenant_id', tenant_id)
    .in('integration_type', ['facebook', 'facebook_lead_ads'])
    .eq('is_active', true)
    .limit(1).maybeSingle();
  if (integ?.shared_from_integration_id && !integ?.api_key) {
    const { data: src } = await supabase.from('tenant_integrations').select('api_key')
      .eq('id', integ.shared_from_integration_id).eq('is_active', true).maybeSingle();
    if (src?.api_key) integ = { ...integ, api_key: src.api_key };
  }
  return integ?.api_key || null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const body = await req.json().catch(() => ({}));
    const { tenant_id, action, campaign_id, daily_budget, lifetime_budget, name_suffix, confirmed } = body;

    if (!tenant_id || !action || !campaign_id) {
      return new Response(JSON.stringify({ error: 'tenant_id, action, campaign_id required' }), { status: 400, headers: corsHeaders });
    }
    if (!confirmed) {
      return new Response(JSON.stringify({ error: 'not_confirmed', message: 'דורש אישור מפורש (confirmed=true)' }), { status: 400, headers: corsHeaders });
    }

    const token = await getFbToken(supabase, tenant_id);
    if (!token) return new Response(JSON.stringify({ error: 'fb_not_connected' }), { status: 400, headers: corsHeaders });

    // Fetch current state for audit
    const beforeRes = await fetch(`https://graph.facebook.com/v21.0/${campaign_id}?fields=id,name,status,daily_budget,lifetime_budget&access_token=${token}`);
    const before = await beforeRes.json();
    if (before?.error) return new Response(JSON.stringify({ error: 'fb_api_error', fb_error: before.error }), { status: 400, headers: corsHeaders });

    let result: any = null;

    if (action === 'update_budget') {
      const params = new URLSearchParams({ access_token: token });
      if (daily_budget != null) params.set('daily_budget', String(Math.round(Number(daily_budget) * 100))); // currency minor units
      if (lifetime_budget != null) params.set('lifetime_budget', String(Math.round(Number(lifetime_budget) * 100)));
      if (!params.has('daily_budget') && !params.has('lifetime_budget')) {
        return new Response(JSON.stringify({ error: 'daily_budget or lifetime_budget required' }), { status: 400, headers: corsHeaders });
      }
      const r = await fetch(`https://graph.facebook.com/v21.0/${campaign_id}`, { method: 'POST', body: params });
      result = await r.json();
      if (result?.error) return new Response(JSON.stringify({ error: 'fb_api_error', fb_error: result.error }), { status: 400, headers: corsHeaders });
    } else if (action === 'duplicate') {
      const params = new URLSearchParams({ access_token: token, deep_copy: 'true', status_option: 'PAUSED' });
      if (name_suffix) params.set('rename_options', JSON.stringify({ rename_suffix: name_suffix }));
      const r = await fetch(`https://graph.facebook.com/v21.0/${campaign_id}/copies`, { method: 'POST', body: params });
      result = await r.json();
      if (result?.error) return new Response(JSON.stringify({ error: 'fb_api_error', fb_error: result.error }), { status: 400, headers: corsHeaders });
    } else {
      return new Response(JSON.stringify({ error: 'invalid_action', valid: ['update_budget', 'duplicate'] }), { status: 400, headers: corsHeaders });
    }

    // Audit
    await supabase.from('agent_action_log').insert({
      tenant_id,
      action_type: `fb_${action}`,
      status: 'success',
      action_details: { campaign_id, before, after: result, request: body },
    }).then(() => {}, (e: any) => console.warn('audit log failed', e));

    return new Response(JSON.stringify({ success: true, action, campaign_id, before, result }), { status: 200, headers: corsHeaders });
  } catch (err: any) {
    console.error('[fb-campaign-control]', err);
    return new Response(JSON.stringify({ error: String(err?.message || err) }), { status: 500, headers: corsHeaders });
  }
});
