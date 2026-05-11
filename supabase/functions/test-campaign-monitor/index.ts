import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

async function runCron(fnName: string, maxBatches = 20) {
  const summary = { invocations: 0, last_response: null as any };
  for (let i = 0; i < maxBatches; i++) {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${fnName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SERVICE_KEY}` },
      body: JSON.stringify({}),
    });
    const json = await res.json().catch(() => ({}));
    summary.invocations++;
    summary.last_response = json;
    if (!json?.has_more) break;
    // small delay between batches to let chained self-invokes settle
    await new Promise((r) => setTimeout(r, 1500));
  }
  return summary;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const tenantFilter: string | undefined = body?.tenant_id;
    const startedAt = new Date();

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // 1) Run both cron syncs end-to-end
    const fb = await runCron('cron-sync-facebook-insights');
    const ga = await runCron('cron-sync-google-ads');

    // 2) Anomaly tasks created in the last hour (Carmen alerts)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    let anomalyQ = supabase
      .from('agent_tasks')
      .select('id, tenant_id, title, description, created_at')
      .eq('task_mode', 'anomaly_alert')
      .gte('created_at', oneHourAgo)
      .order('created_at', { ascending: false });
    if (tenantFilter) anomalyQ = anomalyQ.eq('tenant_id', tenantFilter);
    const { data: anomalies } = await anomalyQ;

    // 3) All tables whose ad-account is currently NOT active (live billing/disable issues)
    let tablesQ = supabase
      .from('crm_tables')
      .select('id, name, tenant_id, integration_type, integration_settings')
      .in('integration_type', ['facebook_insights', 'facebook_ecommerce']);
    if (tenantFilter) tablesQ = tablesQ.eq('tenant_id', tenantFilter);
    const { data: tables } = await tablesQ;

    const billingIssues = (tables || [])
      .map((t: any) => ({
        table_id: t.id,
        tenant_id: t.tenant_id,
        table_name: t.name,
        ad_account_id: t.integration_settings?.ad_account_id,
        account_status: t.integration_settings?.account_status,
        disable_reason: t.integration_settings?.account_disable_reason,
        last_sync_at: t.integration_settings?.last_sync_at,
      }))
      .filter((t) => t.account_status && t.account_status !== 'active');

    // Optional: send WhatsApp summary to David
    const DAVID_PHONE = '972507677613';
    const DAVID_GREEN_API_TENANT = '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019';
    const DAVID_GREEN_API_USER = 'bcd21d1c-3b39-4a7c-9dbf-4c89679110b9';
    let waSend: any = null;
    if (body?.notify === true) {
      const lines: string[] = [];
      lines.push('🧪 *בדיקת ניטור קמפיינים*');
      lines.push('');
      lines.push(`📊 פייסבוק: ${fb.invocations} הרצות | Google Ads: ${ga.invocations} הרצות`);
      lines.push(`🚨 בעיות חיוב פעילות: ${billingIssues.length}`);
      lines.push(`⚠️ אנומליות בשעה האחרונה: ${anomalies?.length || 0}`);
      if (billingIssues.length) {
        lines.push('');
        lines.push('*בעיות חיוב:*');
        for (const b of billingIssues.slice(0, 10)) {
          lines.push(`• ${b.table_name} — ${b.ad_account_id} (${b.account_status}${b.disable_reason ? ` / ${b.disable_reason}` : ''})`);
        }
      }
      if ((anomalies?.length || 0) > 0) {
        lines.push('');
        lines.push('*אנומליות אחרונות:*');
        for (const a of (anomalies || []).slice(0, 10)) {
          lines.push(`• ${a.title}`);
        }
      }
      const message = lines.join('\n');
      const sendRes = await fetch(`${SUPABASE_URL}/functions/v1/send-green-api-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SERVICE_KEY}` },
        body: JSON.stringify({
          phone: DAVID_PHONE,
          message,
          tenant_id: DAVID_GREEN_API_TENANT,
          user_id: DAVID_GREEN_API_USER,
        }),
      });
      waSend = { status: sendRes.status, body: await sendRes.json().catch(() => ({})) };
    }

    const report = {
      started_at: startedAt.toISOString(),
      finished_at: new Date().toISOString(),
      facebook: {
        invocations: fb.invocations,
        last_batch: fb.last_response,
      },
      google_ads: {
        invocations: ga.invocations,
        last_batch: ga.last_response,
      },
      summary: {
        anomalies_last_hour: anomalies?.length || 0,
        billing_issues_live: billingIssues.length,
      },
      anomalies: anomalies || [],
      billing_issues: billingIssues,
    };

    return new Response(JSON.stringify(report, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err: any) {
    console.error('test-campaign-monitor error:', err);
    return new Response(JSON.stringify({ error: err?.message || String(err) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
