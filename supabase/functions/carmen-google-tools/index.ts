// Carmen Google Ads Tools — pause/resume/update_budget at campaign level via Google Ads API v23.
// Per project memory: Google Ads API v23, micros costs, MCC-aware.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

const GADS_API = 'https://googleads.googleapis.com/v23';

async function getGadsAuth(supabase: any, tenant_id: string): Promise<{ access_token?: string; developer_token?: string; login_customer_id?: string; refresh_token?: string; client_id?: string; client_secret?: string } | null> {
  const { data } = await supabase
    .from('tenant_integrations')
    .select('api_key, additional_config')
    .eq('tenant_id', tenant_id)
    .eq('integration_type', 'google_ads')
    .eq('is_active', true)
    .limit(1).maybeSingle();
  if (!data) return null;
  const cfg = data.additional_config || {};
  return {
    refresh_token: cfg.refresh_token || data.api_key,
    developer_token: Deno.env.get('GOOGLE_ADS_DEVELOPER_TOKEN') || cfg.developer_token,
    login_customer_id: cfg.login_customer_id || cfg.mcc_id,
    client_id: Deno.env.get('GOOGLE_CLIENT_ID') || cfg.client_id,
    client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET') || cfg.client_secret,
  };
}

async function exchangeAccessToken(auth: any): Promise<string | null> {
  if (!auth?.refresh_token || !auth?.client_id || !auth?.client_secret) return null;
  const body = new URLSearchParams({
    refresh_token: auth.refresh_token,
    client_id: auth.client_id,
    client_secret: auth.client_secret,
    grant_type: 'refresh_token',
  });
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body });
  const j = await r.json();
  return j.access_token || null;
}

function err(message: string, status = 400, extra: any = {}) {
  return new Response(JSON.stringify({ error: message, ...extra }), { status, headers: corsHeaders });
}
function ok(payload: any) {
  return new Response(JSON.stringify({ success: true, ...payload }), { status: 200, headers: corsHeaders });
}

async function gadsMutate(customer_id: string, body: any, headers: Record<string, string>) {
  const r = await fetch(`${GADS_API}/customers/${customer_id}/googleAds:mutate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  return { ok: r.ok && !j?.error, json: j };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const body = await req.json().catch(() => ({}));
    const { tenant_id, action, customer_id, campaign_id, daily_budget, confirmed } = body;

    if (!tenant_id || !action || !customer_id) return err('tenant_id, action, customer_id required');
    if (!confirmed) return err('not_confirmed', 403, { message: 'דורש אישור מפורש (confirmed=true)' });

    const auth = await getGadsAuth(supabase, tenant_id);
    if (!auth?.developer_token) return err('gads_not_connected');
    const accessToken = await exchangeAccessToken(auth);
    if (!accessToken) return err('gads_token_exchange_failed');

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${accessToken}`,
      'developer-token': auth.developer_token,
    };
    if (auth.login_customer_id) headers['login-customer-id'] = String(auth.login_customer_id).replace(/-/g, '');

    const cleanCustomer = String(customer_id).replace(/-/g, '');

    let result: any = {};
    switch (action) {
      case 'pause':
      case 'resume': {
        if (!campaign_id) return err('campaign_id required');
        const status = action === 'pause' ? 'PAUSED' : 'ENABLED';
        const r = await gadsMutate(cleanCustomer, {
          mutateOperations: [{
            campaignOperation: {
              update: {
                resourceName: `customers/${cleanCustomer}/campaigns/${campaign_id}`,
                status,
              },
              updateMask: 'status',
            },
          }],
        }, headers);
        if (!r.ok) return err('gads_api_error', 400, { gads_error: r.json });
        result = { campaign_id, status };
        break;
      }
      case 'update_budget': {
        if (!campaign_id || daily_budget == null) return err('campaign_id, daily_budget required');
        // Need budget resource id — fetch campaign first
        const sr = await fetch(`${GADS_API}/customers/${cleanCustomer}/googleAds:search`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', ...headers },
          body: JSON.stringify({ query: `SELECT campaign.campaign_budget FROM campaign WHERE campaign.id = ${campaign_id}` }),
        });
        const sj = await sr.json();
        const budgetRes = sj?.results?.[0]?.campaign?.campaignBudget;
        if (!budgetRes) return err('gads_budget_not_found', 400, { search_result: sj });
        const microsAmount = Math.round(Number(daily_budget) * 1_000_000);
        const r = await gadsMutate(cleanCustomer, {
          mutateOperations: [{
            campaignBudgetOperation: {
              update: { resourceName: budgetRes, amountMicros: String(microsAmount) },
              updateMask: 'amount_micros',
            },
          }],
        }, headers);
        if (!r.ok) return err('gads_api_error', 400, { gads_error: r.json });
        result = { campaign_id, daily_budget };
        break;
      }
      default:
        return err('invalid_action', 400, { valid: ['pause','resume','update_budget'] });
    }

    await supabase.from('agent_action_log').insert({
      tenant_id,
      action_type: `gads_${action}`,
      status: 'success',
      action_details: { request: body, result },
    }).then(() => {}, () => {});

    return ok({ action, ...result });
  } catch (e: any) {
    console.error('[carmen-google-tools]', e);
    return err(String(e?.message || e), 500);
  }
});
