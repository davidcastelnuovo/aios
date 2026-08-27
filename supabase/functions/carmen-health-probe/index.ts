import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import {
  buildHealthWhatsAppDigest,
  buildPulseDashboardAbsoluteUrl,
  isSyncStale,
  pickFreshestTablePerPlatform,
} from '../_shared/campaign-pulse.ts';
import {
  fetchRecallUsageSeconds,
  formatRecallBotHours,
  recallApiKey,
  recallBudgetThreshold,
  RECALL_CANARY_MARKER,
  runRecallCreditCanary,
  shouldRunRecallCreditCanary,
  utcMonthRange,
} from '../_shared/recall.ts';
import {
  notifyRecallBudget,
  notifyRecallCreditEmpty,
  notifyRecallCreditRecovered,
} from '../_shared/recall-credit-alert.ts';

// Periodic infrastructure health probe for the Carmen Command Center.
// Invoked by pg_cron (see migration 20260722160000_service_health_checks.sql).
// Writes one row per service into service_health_checks; keeps 7 days of history.
// deploy: recall meeting-bot credit canary (2026-08-26)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MANUS_GW_BASE = 'https://whatsappgw-pzpyrrww.manus.space';
const RETENTION_DAYS = 7;
// Alert anchor tenant (claude_notify_david's default tenant is MarketingCaptain;
// alerts rows anchor to DMM, David's main org)
const DAVID_TENANT = '6ad8f321-25db-4a04-8e44-e57a7c8961b2';

interface CheckRow {
  tenant_id: string | null;
  service: string;
  status: 'ok' | 'warn' | 'down';
  latency_ms: number | null;
  detail: string;
}

const CAMPAIGN_TABLE_TYPES = ['facebook_insights', 'facebook_ecommerce', 'google_ads'];

function campaignServices(client: any): Set<string> {
  return new Set(
    (Array.isArray(client?.services) ? client.services : [])
      .map((service: unknown) => String(service))
      .filter((service: string) => service === 'ppc_meta' || service === 'ppc_google'),
  );
}

function platformTables(tables: any[], platform: 'meta' | 'google'): any[] {
  return tables.filter((table) => platform === 'google'
    ? table.integration_type === 'google_ads'
    : table.integration_type === 'facebook_insights' || table.integration_type === 'facebook_ecommerce');
}

function isAccountConnected(table: any): boolean {
  const settings = table.integration_settings || {};
  if (table.integration_type === 'google_ads') {
    return !!(settings.customer_id || settings.ad_account_id);
  }
  return !!(settings.ad_account_id || settings.account_id || settings.meta_account_id);
}

async function buildTenantHealthDigest(supabase: any, tenantId: string, checks: CheckRow[]): Promise<string> {
  const [{ data: ownedAgencies }, { data: sharedAgencies }, { data: tenantRow }] = await Promise.all([
    supabase.from('agencies').select('id').eq('tenant_id', tenantId),
    supabase.from('agency_tenant_access').select('agency_id').eq('accessing_tenant_id', tenantId),
    supabase.from('tenants').select('slug').eq('id', tenantId).maybeSingle(),
  ]);
  const agencyIds = Array.from(new Set([
    ...(ownedAgencies || []).map((agency: any) => agency.id),
    ...(sharedAgencies || []).map((agency: any) => agency.agency_id),
  ]));
  const { data: allClients } = await supabase.from('clients')
    .select('id, name, services, agency_id, agencies(name)')
    .in('agency_id', agencyIds.length ? agencyIds : ['00000000-0000-0000-0000-000000000000'])
    .eq('status', 'active')
    .order('name');
  const clients = (allClients || []).filter((client: any) => campaignServices(client).size > 0);
  const clientIds = clients.map((client: any) => client.id);
  const { data: allTables } = clientIds.length
    ? await supabase.from('crm_tables')
        .select('id, name, client_id, integration_type, integration_settings, campaign_active, last_sync_at')
        .in('client_id', clientIds)
        .in('integration_type', CAMPAIGN_TABLE_TYPES)
    : { data: [] };

  let issueCount = 0;
  let activeConnections = 0;
  for (const client of clients) {
    const services = campaignServices(client);
    const clientTables = (allTables || []).filter((table: any) => table.client_id === client.id);
    for (const platform of ['meta', 'google'] as const) {
      const expected = platform === 'meta' ? services.has('ppc_meta') : services.has('ppc_google');
      if (!expected) continue;
      const configured = platformTables(clientTables, platform);
      // Existing tables that were explicitly switched off represent a paused
      // campaign and are excluded from both the health and performance reports.
      const active = configured.filter((table: any) => table.campaign_active !== false);
      if (configured.length > 0 && active.length === 0) continue;
      // Missing report tables are shown on the Pulse Dashboard only — never WA.
      if (active.length === 0) continue;
      // One connection per platform — evaluate the freshest table only so an
      // abandoned duplicate (old ecommerce row) cannot false-positive.
      const [best] = pickFreshestTablePerPlatform(active);
      if (!best) continue;
      activeConnections += 1;
      if (!isAccountConnected(best)) {
        issueCount += 1;
        continue;
      }
      if (isSyncStale(best)) {
        issueCount += 1;
      }
    }
  }

  const relevantChecks = checks.filter((check) => check.tenant_id === null || check.tenant_id === tenantId);
  issueCount += relevantChecks.filter((item) => item.status !== 'ok').length;
  const okChecks = relevantChecks.filter((item) => item.status === 'ok').length;
  const tenantSlug = tenantRow?.slug || tenantId;
  return buildHealthWhatsAppDigest({
    activeConnections,
    systemChecks: relevantChecks.length,
    okChecks,
    issueCount,
    dashboardUrl: buildPulseDashboardAbsoluteUrl(tenantSlug),
  });
}

async function timedFetch(url: string, init: RequestInit = {}, timeoutMs = 8000): Promise<{ status: number | null; latency: number; error?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const t0 = performance.now();
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    // Drain the body so the connection is released
    await res.text().catch(() => '');
    return { status: res.status, latency: Math.round(performance.now() - t0) };
  } catch (e) {
    return { status: null, latency: Math.round(performance.now() - t0), error: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(timer);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const rows: CheckRow[] = [];

  // 1. Database round-trip
  {
    const t0 = performance.now();
    const { error } = await supabase.from('tenants').select('id').limit(1);
    const latency = Math.round(performance.now() - t0);
    rows.push({
      tenant_id: null, service: 'db',
      status: error ? 'down' : latency > 1500 ? 'warn' : 'ok',
      latency_ms: latency,
      detail: error ? error.message : 'Supabase Postgres',
    });
  }

  // 2. MCP edge functions — any HTTP answer below 500 proves the function is up
  for (const [service, fn] of [
    ['mcp_system_graph', 'system-graph-mcp'],
    ['mcp_claude', 'claude-mcp'],
    ['mcp_cursor', 'cursor-mcp'],
  ] as const) {
    const res = await timedFetch(`${supabaseUrl}/functions/v1/${fn}`, { method: 'GET' });
    rows.push({
      tenant_id: null, service,
      status: res.status === null ? 'down' : res.status >= 500 ? 'warn' : 'ok',
      latency_ms: res.latency,
      detail: res.status === null ? (res.error ?? 'no response') : `HTTP ${res.status}`,
    });
  }

  // 3. OpenAI API — key from env or the active llm integration row
  // (mirrors resolveOpenAIKey in _shared/ai.ts; local for single-file deploys)
  let openaiKey = Deno.env.get('OPENAI_API_KEY') ?? null;
  if (!openaiKey) {
    try {
      const { data: llmRows } = await supabase
        .from('tenant_integrations')
        .select('settings')
        .eq('integration_type', 'llm')
        .eq('is_active', true);
      for (const row of llmRows ?? []) {
        const k = (row.settings as Record<string, unknown>)?.openai_api_key;
        if (typeof k === 'string' && k.trim()) { openaiKey = k.trim(); break; }
      }
    } catch { /* no key → check skipped */ }
  }
  if (openaiKey) {
    const res = await timedFetch('https://api.openai.com/v1/models?limit=1', {
      headers: { Authorization: `Bearer ${openaiKey}` },
    });
    rows.push({
      tenant_id: null, service: 'openai',
      status: res.status === 200 ? 'ok' : res.status === null ? 'down' : 'warn',
      latency_ms: res.latency,
      detail: res.status === null ? (res.error ?? 'no response') : `HTTP ${res.status}`,
    });

    // 3b. Credit canary — a minimal BILLED call. /v1/models succeeds even with
    // an empty balance, so this is the only reliable "credits are alive" signal.
    const t0 = performance.now();
    let quota: CheckRow = {
      tenant_id: null, service: 'openai_quota', status: 'down', latency_ms: null, detail: 'no response',
    };
    try {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: 'ok' }], max_tokens: 1 }),
      });
      const bodyText = await r.text();
      const isQuota = r.status === 429 || bodyText.includes('insufficient_quota');
      quota = {
        tenant_id: null, service: 'openai_quota',
        status: r.ok ? 'ok' : isQuota ? 'down' : 'warn',
        latency_ms: Math.round(performance.now() - t0),
        detail: r.ok ? 'קרדיט פעיל' : isQuota ? 'הקרדיט נגמר' : `HTTP ${r.status}`,
      };
    } catch (e) {
      quota.detail = e instanceof Error ? e.message : 'canary failed';
    }
    rows.push(quota);

    // Alert on state flip (ok→down) — WhatsApp via claude_notify_david + a row
    // the intel feed picks up. Deduped by comparing to the previous check.
    const { data: prev } = await supabase
      .from('service_health_checks')
      .select('status')
      .eq('service', 'openai_quota')
      .order('checked_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (quota.status === 'down' && prev && prev.status !== 'down') {
      await supabase.from('integration_alerts_log').insert({
        tenant_id: DAVID_TENANT, provider: 'openai', alert_type: 'quota_out',
        reason: 'בדיקת קנרית מחויבת נכשלה — הקרדיט ב-OpenAI נגמר',
      });
      await supabase.rpc('claude_notify_david', {
        p_message: '🚨 הקרדיט ב-OpenAI נגמר! הקול, התמלול והצ׳אט של כרמן מושבתים עד טעינה: platform.openai.com/settings/organization/billing',
      }).then(() => {}, (e: unknown) => console.error('[probe] notify failed', e));
    }
    if (quota.status === 'ok' && prev && prev.status === 'down') {
      await supabase.from('integration_alerts_log').insert({
        tenant_id: DAVID_TENANT, provider: 'openai', alert_type: 'reconnected',
        reason: 'הקרדיט ב-OpenAI חזר לפעול',
      });
    }

    // 3c. Monthly budget guard — warn at 80%, alert + WhatsApp at 95%.
    // Budget lives in the llm integration settings (monthly_budget_usd).
    try {
      const { data: llmRow } = await supabase
        .from('tenant_integrations')
        .select('settings')
        .eq('integration_type', 'llm')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();
      const budget = Number((llmRow?.settings as Record<string, unknown>)?.monthly_budget_usd ?? 0);
      if (budget > 0) {
        const monthStart = new Date();
        monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
        const since = monthStart.toISOString();
        const sumOf = async (table: string, col: string) => {
          const { data } = await supabase.from(table).select(col).gte('created_at', since).limit(20000);
          return (data ?? []).reduce((s: number, r: Record<string, unknown>) => s + Number(r[col] ?? 0), 0);
        };
        const spent =
          (await sumOf('ai_usage_log', 'cost_usd')) +
          (await sumOf('agent_action_log', 'cost_usd')) +
          (await sumOf('marketing_runs', 'cost_usd'));
        const pct = (spent / budget) * 100;
        for (const [threshold, type] of [[95, 'budget_95'], [80, 'budget_80']] as const) {
          if (pct < threshold) continue;
          const { data: already } = await supabase
            .from('integration_alerts_log')
            .select('id').eq('provider', 'openai').eq('alert_type', type).gte('fired_at', since).limit(1);
          if (already?.length) break; // highest crossed threshold alerts once/month
          await supabase.from('integration_alerts_log').insert({
            tenant_id: DAVID_TENANT, provider: 'openai', alert_type: type,
            reason: `שימוש AI החודש: $${spent.toFixed(2)} מתוך תקציב $${budget} (${pct.toFixed(0)}%)`,
          });
          if (type === 'budget_95') {
            await supabase.rpc('claude_notify_david', {
              p_message: `⚠️ רגע לפני שנגמר: השימוש ב-AI הגיע ל-${pct.toFixed(0)}% מהתקציב החודשי ($${spent.toFixed(2)} מתוך $${budget}). כדאי לטעון קרדיט ב-OpenAI.`,
            }).then(() => {}, (e: unknown) => console.error('[probe] notify failed', e));
          }
          break;
        }
      }
    } catch (e) {
      console.error('[probe] budget check failed', e);
    }
  }

  // 3d. Credit canaries for the OTHER LLM providers Carmen can fail over to.
  // Carmen's brain may run on Google (Gemini) or Anthropic (Claude), not only
  // OpenAI — so the monitor must watch every provider that has a key, otherwise
  // a spend cap / empty balance on the ACTIVE provider stays invisible (exactly
  // the blind spot that once let Carmen go silent while "openai_quota" was green).
  {
    // State-flip alert shared by all provider canaries.
    const flipAlert = async (service: string, provider: string, row: CheckRow, downMsg: string, upMsg: string) => {
      const { data: prev } = await supabase
        .from('service_health_checks').select('status')
        .eq('service', service).order('checked_at', { ascending: false }).limit(1).maybeSingle();
      if (row.status === 'down' && prev && prev.status !== 'down') {
        await supabase.from('integration_alerts_log').insert({
          tenant_id: DAVID_TENANT, provider, alert_type: 'quota_out', reason: downMsg,
        });
        await supabase.rpc('claude_notify_david', { p_message: `🚨 ${downMsg}` }).then(() => {}, () => {});
      }
      if (row.status === 'ok' && prev && prev.status === 'down') {
        await supabase.from('integration_alerts_log').insert({
          tenant_id: DAVID_TENANT, provider, alert_type: 'reconnected', reason: upMsg,
        });
      }
    };

    // Resolve the active llm integration's provider keys.
    let gKey: string | null = null, aKey: string | null = null;
    try {
      const { data: llmRow } = await supabase
        .from('tenant_integrations').select('settings')
        .eq('integration_type', 'llm').eq('is_active', true)
        .order('updated_at', { ascending: false }).limit(1).maybeSingle();
      const s = (llmRow?.settings as Record<string, unknown>) || {};
      gKey = typeof s.google_api_key === 'string' && s.google_api_key.trim() ? s.google_api_key.trim() : null;
      aKey = typeof s.anthropic_api_key === 'string' && s.anthropic_api_key.trim() ? s.anthropic_api_key.trim() : null;
    } catch { /* no keys → canaries skipped */ }

    // Google Gemini billed canary
    if (gKey) {
      const t0 = performance.now();
      let row: CheckRow = { tenant_id: null, service: 'google_quota', status: 'down', latency_ms: null, detail: 'no response' };
      try {
        const r = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
          method: 'POST', headers: { Authorization: `Bearer ${gKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'gemini-3-flash-preview', messages: [{ role: 'user', content: 'ok' }], max_tokens: 1 }),
        });
        const body = await r.text();
        const isQuota = r.status === 429 || /RESOURCE_EXHAUSTED|spending cap|quota/i.test(body);
        row = {
          tenant_id: null, service: 'google_quota',
          status: r.ok ? 'ok' : isQuota ? 'down' : 'warn',
          latency_ms: Math.round(performance.now() - t0),
          detail: r.ok ? 'קרדיט פעיל' : isQuota ? 'מכסת Gemini נגמרה' : `HTTP ${r.status}`,
        };
      } catch (e) { row.detail = e instanceof Error ? e.message : 'canary failed'; }
      rows.push(row);
      await flipAlert('google_quota', 'google', row,
        'מכסת ההוצאה של Gemini נגמרה — אם כרמן על Gemini היא תעבור אוטומטית לספק אחר. טען ב-ai.studio/spend',
        'הקרדיט ב-Gemini חזר לפעול');
    }

    // Anthropic Claude billed canary
    if (aKey) {
      const t0 = performance.now();
      let row: CheckRow = { tenant_id: null, service: 'anthropic_quota', status: 'down', latency_ms: null, detail: 'no response' };
      try {
        const r = await fetch('https://api.anthropic.com/v1/chat/completions', {
          method: 'POST', headers: { Authorization: `Bearer ${aKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'claude-sonnet-4-6', messages: [{ role: 'user', content: 'ok' }], max_tokens: 1 }),
        });
        const body = await r.text();
        const isQuota = r.status === 429 || /credit balance|too low|quota/i.test(body);
        row = {
          tenant_id: null, service: 'anthropic_quota',
          status: r.ok ? 'ok' : isQuota ? 'down' : 'warn',
          latency_ms: Math.round(performance.now() - t0),
          detail: r.ok ? 'קרדיט פעיל' : isQuota ? 'הקרדיט ב-Claude נגמר' : `HTTP ${r.status}`,
        };
      } catch (e) { row.detail = e instanceof Error ? e.message : 'canary failed'; }
      rows.push(row);
      await flipAlert('anthropic_quota', 'anthropic', row,
        'הקרדיט ב-Claude נגמר — אם כרמן על Claude היא תעבור אוטומטית לספק אחר. טען ב-console.anthropic.com',
        'הקרדיט ב-Claude חזר לפעול');
    }
  }

  // 3e. Recall meeting-bot credit — alert David on WhatsApp before he invites
  // Carmen to Zoom. Recall has no remaining-balance API (only usage seconds +
  // 402 on create), so we periodically create-and-delete a scheduled bot.
  if (recallApiKey()) {
    const month = utcMonthRange();
    const tUsage = performance.now();
    let usageSeconds: number | null = null;
    let recallApi: CheckRow = {
      tenant_id: null, service: 'recall', status: 'down', latency_ms: null, detail: 'no response',
    };
    try {
      usageSeconds = await fetchRecallUsageSeconds(month.start, month.end);
      const usageLabel = usageSeconds != null ? formatRecallBotHours(usageSeconds) : 'לא ידוע';
      recallApi = {
        tenant_id: null, service: 'recall', status: 'ok',
        latency_ms: Math.round(performance.now() - tUsage),
        detail: `API תקין · ${usageLabel} החודש`,
      };
    } catch (e) {
      recallApi = {
        tenant_id: null, service: 'recall', status: 'down',
        latency_ms: Math.round(performance.now() - tUsage),
        detail: e instanceof Error ? e.message.slice(0, 180) : 'usage failed',
      };
    }
    rows.push(recallApi);

    const { data: recentQuota } = await supabase
      .from('service_health_checks')
      .select('status, detail, checked_at')
      .eq('service', 'recall_quota')
      .order('checked_at', { ascending: false })
      .limit(50);
    const prevQuota = recentQuota?.[0] ?? null;
    const runCanary = recallApi.status === 'ok' && shouldRunRecallCreditCanary(recentQuota ?? []);

    let quota: CheckRow = {
      tenant_id: null, service: 'recall_quota',
      status: (prevQuota?.status as CheckRow['status']) || 'ok',
      latency_ms: recallApi.latency_ms,
      detail: prevQuota?.detail?.replace(` · ${RECALL_CANARY_MARKER}`, '') || 'ממתין לבדיקת קרדיט',
    };
    if (runCanary) {
      const tCanary = performance.now();
      try {
        const canary = await runRecallCreditCanary();
        const usageBit = usageSeconds != null ? ` · ${formatRecallBotHours(usageSeconds)} החודש` : '';
        quota = {
          tenant_id: null, service: 'recall_quota',
          status: canary.creditEmpty ? 'down' : canary.httpStatus < 300 ? 'ok' : 'warn',
          latency_ms: Math.round(performance.now() - tCanary),
          detail: `${canary.detail}${usageBit} · ${RECALL_CANARY_MARKER}`,
        };
      } catch (e) {
        quota = {
          tenant_id: null, service: 'recall_quota', status: 'warn',
          latency_ms: Math.round(performance.now() - tCanary),
          detail: e instanceof Error ? e.message.slice(0, 180) : 'canary failed',
        };
      }
    } else if (recallApi.status !== 'ok') {
      quota = {
        tenant_id: null, service: 'recall_quota', status: 'warn',
        latency_ms: recallApi.latency_ms,
        detail: `דילוג על בדיקת קרדיט — ${recallApi.detail}`,
      };
    }

    rows.push(quota);

    if (quota.status === 'down' && (!prevQuota || prevQuota.status !== 'down')) {
      await notifyRecallCreditEmpty(supabase);
    }
    if (quota.status === 'ok' && prevQuota && prevQuota.status === 'down') {
      await notifyRecallCreditRecovered(supabase);
    }

    const budgetHours = Number(Deno.env.get('RECALL_MONTHLY_HOURS_BUDGET') || 0);
    const threshold = usageSeconds != null ? recallBudgetThreshold(usageSeconds, budgetHours) : null;
    if (threshold) {
      await notifyRecallBudget(supabase, threshold, usageSeconds ?? 0, budgetHours, month.start);
    }
  }

  // 4. WhatsApp gateway per tenant with an active Manus WA integration
  const { data: waIntegrations } = await supabase
    .from('tenant_integrations')
    .select('tenant_id, api_key, settings')
    .eq('integration_type', 'manus_wa')
    .eq('is_active', true)
    .limit(10);
  for (const integ of waIntegrations ?? []) {
    const instanceId = (integ.settings as Record<string, unknown>)?.instance_id;
    if (!instanceId || !integ.api_key) continue;
    const res = await timedFetch(`${MANUS_GW_BASE}/api/v1/instances/${instanceId}/status`, {
      headers: { 'X-Api-Key': integ.api_key },
    });
    rows.push({
      tenant_id: integ.tenant_id, service: 'whatsapp',
      status: res.status === 200 ? 'ok' : res.status === null ? 'down' : 'warn',
      latency_ms: res.latency,
      detail: res.status === null ? (res.error ?? 'no response') : `HTTP ${res.status}`,
    });
  }

  const { error: insertError } = await supabase.from('service_health_checks').insert(rows);

  const deliveries: Array<{ tenant_id: string; sent: boolean; error?: string }> = [];
  const { data: deliverySettings } = await supabase.from('tenant_heartbeat_settings')
    .select('tenant_id, campaign_pulse_phone')
    .eq('campaign_pulse_enabled', true);
  for (const setting of deliverySettings || []) {
    const claim = await supabase.rpc('claim_health_digest_delivery', { p_tenant_id: setting.tenant_id });
    if (claim.error || claim.data !== true) continue;
    try {
      const digest = await buildTenantHealthDigest(supabase, setting.tenant_id, rows);
      const delivery = await supabase.rpc('claude_notify_david', {
        p_message: digest,
        p_tenant: setting.tenant_id,
        p_chat_id: setting.campaign_pulse_phone || null,
      });
      const sent = !delivery.error && delivery.data?.queued === true;
      deliveries.push({
        tenant_id: setting.tenant_id,
        sent,
        ...(delivery.error ? { error: delivery.error.message } : {}),
      });
      if (!sent) {
        await supabase.from('tenant_heartbeat_settings')
          .update({ health_digest_last_sent_at: null })
          .eq('tenant_id', setting.tenant_id);
      }
    } catch (error) {
      await supabase.from('tenant_heartbeat_settings')
        .update({ health_digest_last_sent_at: null })
        .eq('tenant_id', setting.tenant_id);
      deliveries.push({
        tenant_id: setting.tenant_id,
        sent: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Retention: this table only, precise WHERE on checked_at
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 86400000).toISOString();
  await supabase.from('service_health_checks').delete().lt('checked_at', cutoff);

  return new Response(
    JSON.stringify({ success: !insertError, checks: rows.length, deliveries, error: insertError?.message }),
    { status: insertError ? 500 : 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
