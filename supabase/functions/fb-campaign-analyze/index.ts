// Analyzes Facebook campaign performance: today vs 7-day vs 30-day, detects anomalies,
// and returns ad-level spend/leads/CPL for selective enable/disable workflows.
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
    .limit(1)
    .maybeSingle();
  if (integ?.shared_from_integration_id && !integ?.api_key) {
    const { data: src } = await supabase
      .from('tenant_integrations').select('api_key')
      .eq('id', integ.shared_from_integration_id).eq('is_active', true).maybeSingle();
    if (src?.api_key) integ = { ...integ, api_key: src.api_key };
  }
  return integ?.api_key || null;
}

function leadsFromActions(actions: any[]): number {
  if (!Array.isArray(actions)) return 0;
  let leads = 0;
  for (const a of actions) {
    const t = String(a?.action_type || '');
    if (t === 'lead' || t === 'leadgen.other' || t === 'onsite_conversion.lead_grouped' || t.endsWith('.lead')) {
      leads += Number(a?.value || 0);
    }
  }
  return leads;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    const { tenant_id, client_id, campaign_id } = await req.json().catch(() => ({}));
    if (!tenant_id || !campaign_id) {
      return new Response(JSON.stringify({ error: 'tenant_id, campaign_id required' }), { status: 400, headers: corsHeaders });
    }

    let tokenTenant = tenant_id;
    if (client_id) {
      const { data: cl } = await supabase.from('clients').select('tenant_id').eq('id', client_id).maybeSingle();
      if (cl?.tenant_id) tokenTenant = cl.tenant_id;
    }
    let token = await getFbToken(supabase, tokenTenant);
    if (!token && tokenTenant !== tenant_id) token = await getFbToken(supabase, tenant_id);
    if (!token) return new Response(JSON.stringify({ error: 'fb_not_connected' }), { status: 400, headers: corsHeaders });

    const metaRes = await fetch(`https://graph.facebook.com/v21.0/${campaign_id}?fields=id,name,status,effective_status,daily_budget,lifetime_budget,objective,issues_info&access_token=${token}`);
    const meta = await metaRes.json();
    if (meta?.error) return new Response(JSON.stringify({ error: 'fb_api_error', fb_error: meta.error }), { status: 400, headers: corsHeaders });

    const fields = 'spend,impressions,clicks,ctr,cpc,cpm,frequency,actions,cost_per_action_type';
    const fetchInsights = async (date_preset: string) => {
      const r = await fetch(`https://graph.facebook.com/v21.0/${campaign_id}/insights?fields=${fields}&date_preset=${date_preset}&access_token=${token}`);
      const j = await r.json();
      return j?.data?.[0] || null;
    };
    const [today, last7, last30] = await Promise.all([
      fetchInsights('today'),
      fetchInsights('last_7d'),
      fetchInsights('last_30d'),
    ]);

    const cplFrom = (ins: any) => {
      if (!ins) return null;
      const leadAction = (ins.cost_per_action_type || []).find((a: any) =>
        ['lead', 'onsite_conversion.lead_grouped', 'offsite_conversion.fb_pixel_lead', 'leadgen.other'].includes(a.action_type)
        || String(a.action_type || '').endsWith('.lead')
      );
      if (leadAction) return Number(leadAction.value);
      const leads = leadsFromActions(ins.actions || []);
      const spend = Number(ins.spend || 0);
      return leads > 0 ? Number((spend / leads).toFixed(2)) : null;
    };
    const cplToday = cplFrom(today);
    const cpl7 = cplFrom(last7);
    const cpl30 = cplFrom(last30);

    // Ad-level breakdown (last 7d)
    const adsRes = await fetch(`https://graph.facebook.com/v21.0/${campaign_id}/ads?fields=id,name,effective_status,status&limit=200&access_token=${token}`);
    const adsJson = await adsRes.json();
    const adsMeta = Array.isArray(adsJson?.data) ? adsJson.data : [];
    const adInsightsRes = await fetch(`https://graph.facebook.com/v21.0/${campaign_id}/insights?level=ad&date_preset=last_7d&fields=ad_id,ad_name,spend,actions,impressions,clicks&limit=200&access_token=${token}`);
    const adInsightsJson = await adInsightsRes.json();
    const metricsByAd = new Map<string, any>();
    for (const row of (adInsightsJson?.data || [])) {
      const leads = leadsFromActions(row.actions || []);
      const spend = Number(row.spend || 0);
      metricsByAd.set(String(row.ad_id), {
        spend,
        leads,
        impressions: Number(row.impressions || 0),
        clicks: Number(row.clicks || 0),
        cpl: leads > 0 ? Number((spend / leads).toFixed(2)) : null,
      });
    }
    const ads = adsMeta.map((ad: any) => {
      const m = metricsByAd.get(String(ad.id)) || { spend: 0, leads: 0, impressions: 0, clicks: 0, cpl: null };
      return {
        ad_id: ad.id,
        ad_name: ad.name,
        status: ad.status,
        effective_status: ad.effective_status,
        spend_7d: m.spend,
        leads_7d: m.leads,
        cpl_7d: m.cpl,
        impressions_7d: m.impressions,
        clicks_7d: m.clicks,
      };
    }).sort((a: any, b: any) => (a.cpl_7d ?? 999999) - (b.cpl_7d ?? 999999));

    const anomalies: string[] = [];
    if (meta.effective_status && !['ACTIVE', 'CAMPAIGN_PAUSED', 'PAUSED'].includes(meta.effective_status)) {
      anomalies.push(`קמפיין במצב חריג: ${meta.effective_status}`);
    }
    if (meta.issues_info?.length) anomalies.push(`Meta דיווחו על בעיות: ${JSON.stringify(meta.issues_info).slice(0, 200)}`);
    if (cplToday && cpl7 && cplToday > cpl7 * 1.5) anomalies.push(`CPL היום (${cplToday.toFixed(1)}) חורג ב-${(((cplToday / cpl7) - 1) * 100).toFixed(0)}% מהממוצע השבועי`);
    const freq = Number(last7?.frequency || 0);
    if (freq > 3.5) anomalies.push(`Frequency גבוה (${freq.toFixed(2)}) — שקול לרענן יצירה`);
    const ctr7 = Number(last7?.ctr || 0); const ctr30 = Number(last30?.ctr || 0);
    if (ctr30 && ctr7 && ctr7 < ctr30 * 0.7) anomalies.push(`CTR ירד ב-${(((ctr30 - ctr7) / ctr30) * 100).toFixed(0)}% מול 30 ימים`);

    const recommendations: any[] = [];
    if (cplToday && cpl7 && cplToday > cpl7 * 2) recommendations.push({ action: 'pause', reason: 'CPL גבוה פי 2 מהממוצע השבועי', severity: 'high' });
    if (freq > 4) recommendations.push({ action: 'refresh_creative', reason: `frequency ${freq.toFixed(2)}`, severity: 'medium' });
    if (ctr7 && ctr30 && ctr7 < ctr30 * 0.5) recommendations.push({ action: 'pause_or_refresh', reason: 'CTR קטסטרופלי', severity: 'high' });
    const pausedLowCpl = ads.filter((a: any) => a.effective_status === 'PAUSED' && a.cpl_7d != null && a.leads_7d > 0);
    if (pausedLowCpl.length) {
      recommendations.push({
        action: 'enable_low_cpl_ads',
        reason: 'מודעות מושבתות עם CPL נמוך — אפשר להדליק סלקטיבית אחרי אישור',
        severity: 'medium',
        candidate_ad_ids: pausedLowCpl.slice(0, 10).map((a: any) => ({
          ad_id: a.ad_id, ad_name: a.ad_name, cpl_7d: a.cpl_7d, leads_7d: a.leads_7d,
        })),
      });
    }

    return new Response(JSON.stringify({
      success: true,
      campaign: { id: meta.id, name: meta.name, status: meta.status, effective_status: meta.effective_status, objective: meta.objective, daily_budget: meta.daily_budget, lifetime_budget: meta.lifetime_budget },
      metrics: {
        today: { ...today, cpl: cplToday },
        last_7d: { ...last7, cpl: cpl7 },
        last_30d: { ...last30, cpl: cpl30 },
      },
      ads,
      anomalies,
      recommendations,
    }), { status: 200, headers: corsHeaders });
  } catch (err: any) {
    console.error('[fb-campaign-analyze]', err);
    return new Response(JSON.stringify({ error: String(err?.message || err) }), { status: 500, headers: corsHeaders });
  }
});
