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

const NOTIFY_TYPES = new Set(['campaign_stopped', 'ad_disapproved', 'cpl_spike']);

async function resolveRecipients(supabase: any, tenant_id: string, client_id?: string | null) {
  const phones = new Map<string, string>(); // phone -> label

  // Tenant managers (owner/admin/agency_owner)
  const { data: managers } = await supabase
    .from('tenant_users')
    .select('user_id, role')
    .eq('tenant_id', tenant_id)
    .in('role', ['owner', 'admin', 'agency_owner', 'agency_manager']);
  const managerIds = (managers || []).map((m: any) => m.user_id);
  if (managerIds.length) {
    const { data: profs } = await supabase
      .from('profiles').select('id, phone').in('id', managerIds);
    for (const p of profs || []) if (p.phone) phones.set(p.phone, 'manager');
  }

  // Campaigners for the client's agency
  if (client_id) {
    const { data: client } = await supabase
      .from('clients').select('agency_id').eq('id', client_id).maybeSingle();
    if (client?.agency_id) {
      const { data: links } = await supabase
        .from('campaigner_agencies').select('campaigner_id').eq('agency_id', client.agency_id);
      const campIds = (links || []).map((l: any) => l.campaigner_id);
      if (campIds.length) {
        const { data: camps } = await supabase
          .from('campaigners').select('phone, active').in('id', campIds);
        for (const c of camps || []) if (c.active && c.phone) phones.set(c.phone, 'campaigner');
      }
    }
  }
  return Array.from(phones.entries()).map(([phone, role]) => ({ phone, role }));
}

async function notifyWhatsapp(supabase: any, alert: AlertInput, alert_id: string) {
  if (!NOTIFY_TYPES.has(alert.alert_type)) return;
  const recipients = await resolveRecipients(supabase, alert.tenant_id, alert.client_id || null);
  if (!recipients.length) return;

  // Resolve a sender (any tenant manager user_id) for service-role WA call
  const { data: anyOwner } = await supabase
    .from('tenant_users').select('user_id').eq('tenant_id', alert.tenant_id)
    .in('role', ['owner', 'admin']).limit(1).maybeSingle();
  if (!anyOwner?.user_id) return;

  const emoji = alert.severity === 'critical' ? '🔴' : '🟡';
  const typeLabel: Record<string, string> = {
    campaign_stopped: 'הקמפיין הושהה / נדחה ע״י Meta',
    ad_disapproved: 'מודעה לא מאושרת',
    cpl_spike: `CPL חורג (פי ${alert.details?.spike_pct ? (1 + alert.details.spike_pct / 100).toFixed(1) : '?'} מהממוצע השבועי)`,
  };
  const message = `${emoji} התראת קמפיין\n` +
    `קמפיין: ${alert.campaign_name || alert.campaign_id}\n` +
    `הבעיה: ${typeLabel[alert.alert_type] || alert.alert_type}\n` +
    `\nענה "כרמן נתחי ${alert.campaign_name || alert.campaign_id}" לקבלת ניתוח ופעולה.`;

  const fnUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-manus-wa-message`;
  for (const r of recipients) {
    try {
      await fetch(fnUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({
          phoneNumber: r.phone,
          message,
          tenantId: alert.tenant_id,
          senderUserId: anyOwner.user_id,
        }),
      });
    } catch (e) { console.warn('[fb-campaign-monitor] WA send failed', r.phone, e); }
  }
  await supabase.from('campaign_alerts').update({ notified_at: new Date().toISOString() }).eq('id', alert_id);
}

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
  if (data?.id) await notifyWhatsapp(supabase, alert, data.id);
  return data;
}

async function scanCampaign(supabase: any, tenant_id: string, token: string, acc: any, c: any, stats: any) {
  const isStopped = c.effective_status && !['ACTIVE', 'PAUSED', 'CAMPAIGN_PAUSED'].includes(c.effective_status);
  const hasIssues = c.issues_info && c.issues_info.length > 0;

  if (isStopped) {
    const r = await upsertAlert(supabase, {
      tenant_id, campaign_id: c.id, campaign_name: c.name, ad_account_id: acc.id,
      alert_type: 'campaign_stopped', severity: 'critical',
      details: { effective_status: c.effective_status, issues: c.issues_info || [] },
    });
    if (r) stats.alerts_created++;
  } else if (hasIssues) {
    const r = await upsertAlert(supabase, {
      tenant_id, campaign_id: c.id, campaign_name: c.name, ad_account_id: acc.id,
      alert_type: 'campaign_with_issues', severity: 'warning',
      details: { issues: c.issues_info },
    });
    if (r) stats.alerts_created++;
  }

  if (c.effective_status !== 'ACTIVE') return;

  try {
    const [insJ, ins7J] = await Promise.all([
      fetch(`https://graph.facebook.com/v21.0/${c.id}/insights?fields=spend,frequency,ctr,cost_per_action_type&date_preset=today&access_token=${token}`).then(r => r.json()),
      fetch(`https://graph.facebook.com/v21.0/${c.id}/insights?fields=cost_per_action_type,frequency,ctr&date_preset=last_7d&access_token=${token}`).then(r => r.json()),
    ]);
    const today = insJ?.data?.[0];
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
  } catch (_) { /* skip */ }
}

async function scanAccount(supabase: any, tenant_id: string, token: string, acc: any, stats: any) {
  const fields = 'id,name,status,effective_status,daily_budget,issues_info';
  const [campJson, adsJ] = await Promise.all([
    fetch(`https://graph.facebook.com/v21.0/${acc.id}/campaigns?fields=${fields}&limit=200&access_token=${token}`).then(r => r.json()),
    fetch(`https://graph.facebook.com/v21.0/${acc.id}/ads?fields=id,name,effective_status,campaign{id,name}&limit=200&effective_status=["DISAPPROVED","PENDING_REVIEW"]&access_token=${token}`).then(r => r.json()),
  ]);
  if (campJson?.error) { stats.errors++; return; }

  const campaigns = campJson?.data || [];
  stats.campaigns_scanned += campaigns.length;
  // Parallel per-campaign in chunks to limit concurrency
  const chunkSize = 8;
  for (let i = 0; i < campaigns.length; i += chunkSize) {
    await Promise.all(campaigns.slice(i, i + chunkSize).map((c: any) => scanCampaign(supabase, tenant_id, token, acc, c, stats)));
  }

  for (const ad of adsJ?.data || []) {
    if (['DISAPPROVED', 'PENDING_REVIEW'].includes(ad.effective_status)) {
      const r = await upsertAlert(supabase, {
        tenant_id, campaign_id: ad.campaign?.id || ad.id, campaign_name: ad.campaign?.name,
        ad_account_id: acc.id, alert_type: 'ad_disapproved',
        severity: ad.effective_status === 'DISAPPROVED' ? 'critical' : 'warning',
        details: { ad_id: ad.id, ad_name: ad.name, ad_status: ad.effective_status },
      });
      if (r) stats.alerts_created++;
    }
  }
}

async function scanTenant(supabase: any, tenant_id: string, token: string, stats: any) {
  stats.tenants++;
  try {
    const accRes = await fetch(`https://graph.facebook.com/v21.0/me/adaccounts?fields=id,name,account_status&limit=50&access_token=${token}`);
    const accJson = await accRes.json();
    if (accJson?.error) { stats.errors++; return; }
    const accounts = accJson?.data || [];
    // Parallel accounts
    await Promise.all(accounts.map((acc: any) => scanAccount(supabase, tenant_id, token, acc, stats).catch((e: any) => {
      console.error('[fb-campaign-monitor] account error', acc.id, e?.message);
      stats.errors++;
    })));
  } catch (e: any) {
    console.error('[fb-campaign-monitor] tenant error', tenant_id, e?.message);
    stats.errors++;
  }
}

async function runScan() {
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
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

  await Promise.all(Array.from(tokensByTenant.entries()).map(([tid, tok]) => scanTenant(supabase, tid, tok, stats)));
  console.log('[fb-campaign-monitor] done', JSON.stringify(stats));
  return stats;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const url = new URL(req.url);
  const sync = url.searchParams.get('sync') === '1';

  try {
    if (sync) {
      const stats = await runScan();
      return new Response(JSON.stringify({ success: true, stats }), { status: 200, headers: corsHeaders });
    }
    // Background mode: return immediately so cron / clients don't time out
    // @ts-ignore EdgeRuntime is provided in Supabase Edge Functions
    EdgeRuntime.waitUntil(runScan().catch((e) => console.error('[fb-campaign-monitor] bg', e)));
    return new Response(JSON.stringify({ success: true, started: true }), { status: 202, headers: corsHeaders });
  } catch (err: any) {
    console.error('[fb-campaign-monitor]', err);
    return new Response(JSON.stringify({ error: String(err?.message || err) }), { status: 500, headers: corsHeaders });
  }
});
