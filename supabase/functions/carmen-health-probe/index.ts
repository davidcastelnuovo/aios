import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

// Periodic infrastructure health probe for the Carmen Command Center.
// Invoked by pg_cron (see migration 20260722160000_service_health_checks.sql).
// Writes one row per service into service_health_checks; keeps 7 days of history.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MANUS_GW_BASE = 'https://whatsappgw-pzpyrrww.manus.space';
const RETENTION_DAYS = 7;

interface CheckRow {
  tenant_id: string | null;
  service: string;
  status: 'ok' | 'warn' | 'down';
  latency_ms: number | null;
  detail: string;
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
  for (const [service, fn] of [['mcp_system_graph', 'system-graph-mcp'], ['mcp_claude', 'claude-mcp']] as const) {
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

  // Retention: this table only, precise WHERE on checked_at
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 86400000).toISOString();
  await supabase.from('service_health_checks').delete().lt('checked_at', cutoff);

  return new Response(
    JSON.stringify({ success: !insertError, checks: rows.length, error: insertError?.message }),
    { status: insertError ? 500 : 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
