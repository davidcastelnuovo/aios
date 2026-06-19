// Cron: scans all tenants' active Facebook campaigns, detects anomalies, writes to campaign_alerts.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

type AlertInput = {
  tenant_id: string;
  client_id?: string | null;
  campaign_id: string;
  campaign_name?: string;
  ad_account_id?: string;
  alert_type: string;
  severity: 'info' | 'warning' | 'critical';
  details: Record<string, any>;
};

async function upsertAlert(supabase: any, alert: AlertInput) {
  // Avoid duplicates: skip if same open alert exists in last 24h
  const { data: existing } = await supabase
    .from('campaign_alerts')
    .select('id')
    .eq('tenant_id', alert.tenant_id)
    .eq('campaign_id', alert.campaign_id)
    .eq('alert_type', alert.alert_type)
    .is('resolved_at', null)
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .limit(1).maybeSingle();
  if (existing) return null;
  const { data } = await supabase.from('campaign_alerts').insert(alert).select('id').single();
  return data;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Get all active FB integrations
    const { data: integrations } = await supabase
      .from('tenant_integrations')
      .select('tenant_id, api_key, shared_from_integration_id')
      .in('integration_type', ['facebook', 'facebook_lead_ads'])
      .eq('is_active', true);

    const stats = { tenants: 0, campaigns_scanned: 0, alerts_created: 0, errors: 0 };
    const tokensByTenant = new Map<string, string>();

    for (const integ of integrations || []) {
      let token = integ.api_key as string | null;
      if (!token && integ.shared_from_integration_id) {
        const { data: src } = await supabase.from('tenant_integrations').select('api_key')
          .eq('id', integ.shared_from_integration_id).eq('is_active', true).maybeSingle();
        token = src?.api_key || null;
      }
      if (token) tokensByTenant.set(integ.tenant_id, token);
    }

    for (const [tenant_id, token] of tokensByTenant) {
      stats.tenants++;
      try {
        // Fetch ad accounts
        const accRes = await fetch(`https://graph.facebook.com/v21.0/me/adaccounts?fields=id,name,account_status&limit=50&access_token=${token}`);
        const accJson = await accRes.json();
        if (accJson?.error) { stats.errors++; continue; }

        for (const acc of accJson?.data || []) {
          // Active+paused campaigns with insights last 7d
          const fields = 'id,name,status,effective_status,daily_budget,issues_info';
          const campRes = await fetch(`https://graph.facebook.com/v21.0/${acc.id}/campaigns?fields=${fields}&limit=200&access_token=${token}`);
          const campJson = await campRes.json();
          if (campJson?.error) { stats.errors++; continue; }

          for (const c of campJson?.data || []) {
            stats.campaigns_scanned++;
            const isStopped = c.effective_status && !['ACTIVE', 'PAUSED', 'CAMPAIGN_PAUSED'].includes(c.effective_status);
            const hasIssues = c.issues_info && c.issues_info.length > 0;

            if (isStopped) {
              const r = await upsertAlert(supabase, {
                tenant_id,
                campaign_id: c.id,
                campaign_name: c.name,
                ad_account_id: acc.id,
                alert_type: 'campaign_stopped',
                severity: 'critical',
                details: { effective_status: c.effective_status, issues: c.issues_info || [] },
              });
              if (r) stats.alerts_created++;
            } else if (hasIssues) {
              const r = await upsertAlert(supabase, {
                tenant_id,
                campaign_id: c.id,
                campaign_name: c.name,
                ad_account_id: acc.id,
                alert_type: 'campaign_with_issues',
                severity: 'warning',
                details: { issues: c.issues_info },
              });
              if (r) stats.alerts_created++;
            }

            // Only check CPL/frequency for ACTIVE campaigns
            if (c.effective_status === 'ACTIVE') {
              try {
                const insR = await fetch(`https://graph.facebook.com/v21.0/${c.id}/insights?fields=spend,frequency,ctr,cost_per_action_type&date_preset=today&access_token=${token}`);
                const insJ = await insR.json();
                const today = insJ?.data?.[0];
                const ins7R = await fetch(`https://graph.facebook.com/v21.0/${c.id}/insights?fields=cost_per_action_type,frequency,ctr&date_preset=last_7d&access_token=${token}`);
                const ins7J = await ins7R.json();
                const last7 = ins7J?.data?.[0];

                const cplToday = (today?.cost_per_action_type || []).find((a: any) => a.action_type?.includes('lead'))?.value;
                const cpl7 = (last7?.cost_per_action_type || []).find((a: any) => a.action_type?.includes('lead'))?.value;
                if (cplToday && cpl7 && Number(cplToday) > Number(cpl7) * 1.5) {
                  const r = await upsertAlert(supabase, {
                    tenant_id, campaign_id: c.id, campaign_name: c.name, ad_account_id: acc.id,
                    alert_type: 'cpl_spike', severity: 'warning',
                    details: { cpl_today: Number(cplToday), cpl_7d_avg: Number(cpl7), spike_pct: Math.round(((Number(cplToday) / Number(cpl7)) - 1) * 100) },
                  });
                  if (r) stats.alerts_created++;
                }
                const freq = Number(last7?.frequency || 0);
                if (freq > 3.5) {
                  const r = await upsertAlert(supabase, {
                    tenant_id, campaign_id: c.id, campaign_name: c.name, ad_account_id: acc.id,
                    alert_type: 'frequency_high', severity: 'info',
                    details: { frequency: freq },
                  });
                  if (r) stats.alerts_created++;
                }
              } catch (_) { /* per-campaign error skip */ }
            }
          }

          // Disapproved ads
          const adsR = await fetch(`https://graph.facebook.com/v21.0/${acc.id}/ads?fields=id,name,effective_status,campaign{id,name}&limit=200&access_token=${token}`);
          const adsJ = await adsR.json();
          for (const ad of adsJ?.data || []) {
            if (['DISAPPROVED', 'PENDING_REVIEW'].includes(ad.effective_status)) {
              const r = await upsertAlert(supabase, {
                tenant_id,
                campaign_id: ad.campaign?.id || ad.id,
                campaign_name: ad.campaign?.name,
                ad_account_id: acc.id,
                alert_type: 'ad_disapproved',
                severity: ad.effective_status === 'DISAPPROVED' ? 'critical' : 'warning',
                details: { ad_id: ad.id, ad_name: ad.name, ad_status: ad.effective_status },
              });
              if (r) stats.alerts_created++;
            }
          }
        }
      } catch (e: any) {
        console.error('[fb-campaign-monitor] tenant error', tenant_id, e?.message);
        stats.errors++;
      }
    }

    return new Response(JSON.stringify({ success: true, stats }), { status: 200, headers: corsHeaders });
  } catch (err: any) {
    console.error('[fb-campaign-monitor]', err);
    return new Response(JSON.stringify({ error: String(err?.message || err) }), { status: 500, headers: corsHeaders });
  }
});
