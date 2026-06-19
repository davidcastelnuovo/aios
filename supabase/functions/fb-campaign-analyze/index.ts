// Analyzes Facebook campaign performance: today vs 7-day vs 30-day, detects anomalies.
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

function avg(nums: number[]) { return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0; }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    const { tenant_id, campaign_id } = await req.json().catch(() => ({}));
    if (!tenant_id || !campaign_id) {
      return new Response(JSON.stringify({ error: 'tenant_id, campaign_id required' }), { status: 400, headers: corsHeaders });
    }

    const token = await getFbToken(supabase, tenant_id);
    if (!token) return new Response(JSON.stringify({ error: 'fb_not_connected' }), { status: 400, headers: corsHeaders });

    // 1) Campaign metadata
    const metaRes = await fetch(`https://graph.facebook.com/v21.0/${campaign_id}?fields=id,name,status,effective_status,daily_budget,lifetime_budget,objective,issues_info&access_token=${token}`);
    const meta = await metaRes.json();
    if (meta?.error) return new Response(JSON.stringify({ error: 'fb_api_error', fb_error: meta.error }), { status: 400, headers: corsHeaders });

    // 2) Insights for 3 windows in parallel
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

    // 3) Compute CPL (lead actions)
    const cplFrom = (ins: any) => {
      if (!ins) return null;
      const leadAction = (ins.cost_per_action_type || []).find((a: any) =>
        ['lead', 'onsite_conversion.lead_grouped', 'offsite_conversion.fb_pixel_lead'].includes(a.action_type)
      );
      return leadAction ? Number(leadAction.value) : null;
    };
    const cplToday = cplFrom(today);
    const cpl7 = cplFrom(last7);
    const cpl30 = cplFrom(last30);

    // 4) Anomalies
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

    // 5) Recommendations
    const recommendations: any[] = [];
    if (cplToday && cpl7 && cplToday > cpl7 * 2) recommendations.push({ action: 'pause', reason: 'CPL גבוה פי 2 מהממוצע השבועי', severity: 'high' });
    if (freq > 4) recommendations.push({ action: 'refresh_creative', reason: `frequency ${freq.toFixed(2)}`, severity: 'medium' });
    if (ctr7 && ctr30 && ctr7 < ctr30 * 0.5) recommendations.push({ action: 'pause_or_refresh', reason: 'CTR קטסטרופלי', severity: 'high' });

    return new Response(JSON.stringify({
      success: true,
      campaign: { id: meta.id, name: meta.name, status: meta.status, effective_status: meta.effective_status, objective: meta.objective, daily_budget: meta.daily_budget, lifetime_budget: meta.lifetime_budget },
      metrics: {
        today: { ...today, cpl: cplToday },
        last_7d: { ...last7, cpl: cpl7 },
        last_30d: { ...last30, cpl: cpl30 },
      },
      anomalies,
      recommendations,
    }), { status: 200, headers: corsHeaders });
  } catch (err: any) {
    console.error('[fb-campaign-analyze]', err);
    return new Response(JSON.stringify({ error: String(err?.message || err) }), { status: 500, headers: corsHeaders });
  }
});
