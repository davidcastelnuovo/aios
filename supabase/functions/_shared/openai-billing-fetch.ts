/**
 * Server-side OpenAI Admin API fetch for billing/usage.
 * Never log admin keys or raw error bodies that may contain secrets.
 */
import {
  buildOpenAiBillingStatus,
  extractDailyCostBuckets,
  extractDailyUsageBuckets,
  monthUtcBounds,
  redactSecretsFromText,
} from "./openai-billing.ts";

export async function resolveOpenAiAdminKey(
  supabase: { from: (t: string) => any },
  tenantId: string,
): Promise<{ key: string | null; source: string | null }> {
  const fromEnv = Deno.env.get("OPENAI_ADMIN_KEY") || Deno.env.get("OPENAI_ADMIN_API_KEY");
  if (fromEnv && String(fromEnv).trim()) {
    return { key: String(fromEnv).trim(), source: "env:OPENAI_ADMIN_KEY" };
  }
  try {
    const { data } = await supabase
      .from("tenant_integrations")
      .select("settings")
      .eq("tenant_id", tenantId)
      .eq("integration_type", "llm")
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const s = (data?.settings || {}) as Record<string, string>;
    const fromSettings = s.openai_admin_api_key || s.openai_admin_key || s.openai_organization_admin_key;
    if (fromSettings && String(fromSettings).trim()) {
      return { key: String(fromSettings).trim(), source: "tenant_integrations.llm.settings" };
    }
  } catch { /* ignore */ }
  return { key: null, source: null };
}

async function openaiAdminGet(
  pathWithQuery: string,
  adminKey: string,
): Promise<{ ok: boolean; status: number; json: any; error?: string }> {
  try {
    const res = await fetch(`https://api.openai.com/v1${pathWithQuery}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${adminKey}`,
        "Content-Type": "application/json",
      },
    });
    const text = await res.text();
    let json: any = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = null; }
    if (!res.ok) {
      const msg = redactSecretsFromText(
        json?.error?.message || json?.message || text || `HTTP ${res.status}`,
      );
      return { ok: false, status: res.status, json, error: msg };
    }
    return { ok: true, status: res.status, json };
  } catch (e: any) {
    return { ok: false, status: 0, json: null, error: redactSecretsFromText(e?.message || String(e)) };
  }
}

export async function fetchOpenAiBillingStatus(args: {
  supabase: { from: (t: string) => any };
  tenantId: string;
  includeTokens?: boolean;
}): Promise<Record<string, unknown>> {
  const { supabase, tenantId } = args;
  const includeTokens = args.includeTokens !== false;
  const { key, source } = await resolveOpenAiAdminKey(supabase, tenantId);

  if (!key) {
    return {
      ok: false,
      admin_available: false,
      error: "חסר מפתח Admin של OpenAI. הגדירי OPENAI_ADMIN_KEY ב-Supabase או openai_admin_api_key באינטגרציית llm.",
      remaining_credit: null,
      remaining_credit_available: false,
      remaining_credit_reason: "Admin API key missing",
      setup: {
        dashboard_admin_keys: "https://platform.openai.com/settings/organization/admin-keys",
        billing_dashboard: "https://platform.openai.com/settings/organization/billing",
      },
    };
  }

  const period = monthUtcBounds();
  const costsQs = `start_time=${period.start_time}&end_time=${period.end_time}&bucket_width=1d&limit=31`;
  const costsRes = await openaiAdminGet(`/organization/costs?${costsQs}`, key);

  let usageRes: { ok: boolean; status: number; json: any; error?: string } | null = null;
  if (includeTokens) {
    usageRes = await openaiAdminGet(`/organization/usage/completions?${costsQs}`, key);
  }

  const limitsRes = await openaiAdminGet("/organization/spend_limits", key);
  const limitsAlt = !limitsRes.ok
    ? await openaiAdminGet("/organization/spend_limit", key)
    : null;
  const spend = limitsRes.ok ? limitsRes : (limitsAlt?.ok ? limitsAlt : limitsRes);

  const status = buildOpenAiBillingStatus({
    costs: costsRes.ok ? costsRes.json : null,
    usage: usageRes?.ok ? usageRes.json : null,
    spendLimits: spend.ok ? spend.json : null,
    costsError: costsRes.ok ? null : costsRes.error,
    usageError: usageRes && !usageRes.ok ? usageRes.error : null,
    spendLimitsError: spend.ok ? null : spend.error,
    period,
    authSource: source,
  });

  const daily_costs = costsRes.ok ? extractDailyCostBuckets(costsRes.json) : [];
  const daily_usage = usageRes?.ok ? extractDailyUsageBuckets(usageRes.json) : [];

  return {
    ...status,
    admin_available: !!(costsRes.ok || usageRes?.ok),
    daily_costs,
    daily_usage,
    apis_used: {
      costs: costsRes.ok ? "GET /v1/organization/costs" : null,
      usage: usageRes?.ok ? "GET /v1/organization/usage/completions" : null,
      spend_limits: spend.ok ? "GET /v1/organization/spend_limits" : null,
    },
    unavailable_fields: {
      remaining_credit: "Not exposed by OpenAI public Admin API (dashboard only)",
      spend_limits: spend.ok ? null : (spend.error || "Endpoint unavailable for this org"),
    },
  };
}
