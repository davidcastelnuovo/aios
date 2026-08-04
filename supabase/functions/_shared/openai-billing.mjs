/**
 * OpenAI organization billing/usage helpers for Carmen.
 *
 * Official Admin API (requires an Admin API key — not a normal sk- project key):
 *   GET /v1/organization/costs
 *   GET /v1/organization/usage/completions
 *
 * Remaining prepaid credit / account balance is NOT exposed by any supported
 * public API (dashboard-only). Never invent a balance.
 */

export const OPENAI_CREDIT_BALANCE_UNAVAILABLE_REASON =
  "OpenAI does not expose remaining prepaid credit/balance via the public Admin API. Check https://platform.openai.com/settings/organization/billing";

export const OPENAI_BILLING_REFUSAL_HE =
  "רק סופר־אדמין יכול לבדוק סטטוס חיוב/שימוש של OpenAI.";

export function isSuperAdminRole(role) {
  return String(role || "").toLowerCase() === "super_admin";
}

export function monthUtcBounds(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
  const end = now;
  return {
    start_time: Math.floor(start.getTime() / 1000),
    end_time: Math.floor(end.getTime() / 1000),
    period_label: `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}`,
  };
}

/** Sum cost buckets from GET /v1/organization/costs response. */
export function sumOrganizationCosts(payload) {
  const buckets = Array.isArray(payload?.data) ? payload.data : [];
  let total = 0;
  let currency = "usd";
  let bucketCount = 0;
  const byLineItem = {};

  for (const bucket of buckets) {
    const results = Array.isArray(bucket?.results) ? bucket.results : [];
    for (const row of results) {
      const amount = row?.amount;
      const value = typeof amount?.value === "number" ? amount.value : Number(amount?.value);
      if (!Number.isFinite(value)) continue;
      total += value;
      if (amount?.currency) currency = String(amount.currency).toLowerCase();
      const li = row?.line_item || "other";
      byLineItem[li] = (byLineItem[li] || 0) + value;
      bucketCount += 1;
    }
  }

  return {
    total_cost: roundMoney(total),
    currency,
    line_items: Object.entries(byLineItem)
      .map(([name, value]) => ({ name, value: roundMoney(value) }))
      .sort((a, b) => b.value - a.value),
    result_rows: bucketCount,
    bucket_count: buckets.length,
  };
}

/** Aggregate completions usage buckets. */
export function sumCompletionsUsage(payload) {
  const buckets = Array.isArray(payload?.data) ? payload.data : [];
  let inputTokens = 0;
  let outputTokens = 0;
  let requests = 0;
  for (const bucket of buckets) {
    const results = Array.isArray(bucket?.results) ? bucket.results : [];
    for (const row of results) {
      inputTokens += Number(row?.input_tokens) || 0;
      outputTokens += Number(row?.output_tokens) || 0;
      requests += Number(row?.num_model_requests) || 0;
    }
  }
  return {
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    total_tokens: inputTokens + outputTokens,
    num_model_requests: requests,
    bucket_count: buckets.length,
  };
}

export function roundMoney(n) {
  return Math.round((Number(n) || 0) * 1e6) / 1e6;
}

/**
 * Build a safe structured status object. Never fabricates remaining credit.
 */
export function buildOpenAiBillingStatus({
  costs = null,
  usage = null,
  spendLimits = null,
  costsError = null,
  usageError = null,
  spendLimitsError = null,
  period = null,
  authSource = null,
} = {}) {
  const periodInfo = period || monthUtcBounds();
  const costSummary = costs ? sumOrganizationCosts(costs) : null;
  const usageSummary = usage ? sumCompletionsUsage(usage) : null;

  const remainingCreditAvailable = false;
  const hardSoft =
    spendLimits && typeof spendLimits === "object"
      ? {
          available: true,
          raw: sanitizeSpendLimits(spendLimits),
        }
      : {
          available: false,
          reason: spendLimitsError || "Spend limits endpoint unavailable or not configured",
        };

  return {
    ok: !!(costSummary || usageSummary),
    provider: "openai",
    currency: costSummary?.currency || "usd",
    period: periodInfo.period_label,
    period_start_unix: periodInfo.start_time,
    period_end_unix: periodInfo.end_time,
    remaining_credit: null,
    remaining_credit_available: remainingCreditAvailable,
    remaining_credit_reason: OPENAI_CREDIT_BALANCE_UNAVAILABLE_REASON,
    current_month_usage_cost: costSummary?.total_cost ?? null,
    current_month_usage_tokens: usageSummary
      ? {
          input_tokens: usageSummary.input_tokens,
          output_tokens: usageSummary.output_tokens,
          total_tokens: usageSummary.total_tokens,
          num_model_requests: usageSummary.num_model_requests,
        }
      : null,
    line_items: costSummary?.line_items || [],
    limits: hardSoft,
    last_updated: new Date().toISOString(),
    auth_source: authSource || null,
    errors: {
      costs: costsError || null,
      usage: usageError || null,
      spend_limits: spendLimitsError || null,
    },
  };
}

function sanitizeSpendLimits(payload) {
  // Pass through numeric/limit fields only — never secrets.
  if (Array.isArray(payload?.data)) {
    return payload.data.map((row) => ({
      threshold_amount: row?.threshold_amount ?? row?.amount ?? null,
      currency: row?.currency || null,
      interval: row?.interval || null,
      hard_limit: row?.hard_limit ?? row?.is_hard_limit ?? null,
      soft_limit: row?.soft_limit ?? null,
    }));
  }
  return {
    threshold_amount: payload?.threshold_amount ?? null,
    currency: payload?.currency || null,
    interval: payload?.interval || null,
  };
}

/** Concise Hebrew/English summary safe for WhatsApp (no keys). */
export function formatOpenAiBillingWhatsApp(status) {
  if (!status) return "אין נתוני חיוב OpenAI.";
  if (status.error && !status.ok) return String(status.error);

  const lines = [];
  lines.push("OpenAI — סטטוס חיוב/שימוש");
  lines.push(`תקופה: ${status.period || "החודש הנוכחי"} (UTC)`);

  if (status.remaining_credit_available && status.remaining_credit != null) {
    lines.push(`יתרה: ${status.remaining_credit} ${String(status.currency || "usd").toUpperCase()}`);
  } else {
    lines.push("יתרת קרדיט: לא זמינה ב-API הרשמי (רק בדשבורד OpenAI)");
  }

  if (status.current_month_usage_cost != null) {
    lines.push(
      `שימוש החודש: $${Number(status.current_month_usage_cost).toFixed(2)} ${String(status.currency || "usd").toUpperCase()}`,
    );
  } else if (status.errors?.costs) {
    lines.push(`שימוש כספי: לא זמין (${shortErr(status.errors.costs)})`);
  }

  const tok = status.current_month_usage_tokens;
  if (tok) {
    lines.push(
      `טוקנים החודש: ${tok.total_tokens.toLocaleString("en-US")} (in ${tok.input_tokens.toLocaleString("en-US")} / out ${tok.output_tokens.toLocaleString("en-US")}, ${tok.num_model_requests} בקשות)`,
    );
  }

  if (status.limits?.available && Array.isArray(status.limits.raw) && status.limits.raw.length) {
    const lim = status.limits.raw[0];
    lines.push(
      `מגבלת הוצאה: ${lim.threshold_amount ?? "?"} ${String(lim.currency || status.currency || "").toUpperCase()} / ${lim.interval || "?"}`,
    );
  } else {
    lines.push("מגבלות hard/soft: לא זמינות דרך ה-API או לא הוגדרו");
  }

  if (status.last_updated) {
    lines.push(`עודכן: ${status.last_updated}`);
  }

  return lines.join("\n");
}

function shortErr(msg) {
  const s = String(msg || "").replace(/\s+/g, " ").trim();
  return s.length > 120 ? `${s.slice(0, 117)}…` : s;
}

export function redactSecretsFromText(text) {
  return String(text || "")
    .replace(/sk-[a-zA-Z0-9_\-]{10,}/g, "sk-***")
    .replace(/Bearer\s+[A-Za-z0-9_\-\.]+/gi, "Bearer ***");
}
