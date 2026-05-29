// Shared helper to fire integration_disconnected / ad_account_blocked triggers
// with throttle (default 6h per tenant+provider+account+alert_type) and rich payload.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export type AlertType = "disconnected" | "blocked" | "reconnected";

export interface FireIntegrationAlertInput {
  tenant_id: string;
  provider: string; // e.g. 'facebook', 'google_ads', 'google_analytics', 'gsc', 'gmail', 'telegram', 'green_api', 'manychat'
  alert_type: AlertType;
  account_id?: string | null;
  account_name?: string | null;
  client_id?: string | null;
  client_name?: string | null;
  reason?: string | null;
  /** Throttle window in hours. Default 6. Pass 0 to disable throttle. */
  throttleHours?: number;
}

const PROVIDER_LABEL_HE: Record<string, string> = {
  facebook: "Meta / Facebook Ads",
  meta: "Meta / Facebook Ads",
  google_ads: "Google Ads",
  google_analytics: "Google Analytics",
  ga4: "Google Analytics",
  gsc: "Google Search Console",
  google_search_console: "Google Search Console",
  gmail: "Gmail",
  telegram: "Telegram",
  green_api: "WhatsApp (Green API)",
  manychat: "ManyChat",
  unified_to: "Unified.to",
  ahrefs: "Ahrefs",
};

function providerLabel(provider: string): string {
  return PROVIDER_LABEL_HE[provider] ?? provider;
}

function accountLink(provider: string, accountId?: string | null): string {
  if (!accountId) return "";
  switch (provider) {
    case "facebook":
    case "meta":
      return `https://business.facebook.com/adsmanager/manage/accounts?act=${String(accountId).replace(/^act_/, "")}`;
    case "google_ads":
      return `https://ads.google.com/aw/overview?ocid=${accountId}`;
    case "google_analytics":
    case "ga4":
      return `https://analytics.google.com/analytics/web/#/p${accountId}/reports`;
    case "gsc":
    case "google_search_console":
      return `https://search.google.com/search-console?resource_id=${encodeURIComponent(accountId)}`;
    default:
      return "";
  }
}

function internalLinkFor(provider: string, tenantSlug: string | null): string {
  const base = tenantSlug ? `/t/${tenantSlug}` : "";
  if (["facebook", "meta", "google_ads", "google_analytics", "ga4", "gsc", "google_search_console", "ahrefs"].includes(provider)) {
    return `${base}/integrations`;
  }
  if (["gmail", "telegram", "green_api", "manychat", "unified_to"].includes(provider)) {
    return `${base}/integrations`;
  }
  return `${base}/integrations`;
}

const REASON_HE: Record<string, string> = {
  invalid_grant: "אסימון רענון לא תקף — נדרש חיבור מחדש",
  token_expired: "אסימון פג תוקף — נדרש חיבור מחדש",
  unauthorized: "הרשאה נדחתה (401)",
  account_suspended: "חשבון מודעות הושעה",
  billing: "בעיית חיוב באמצעי תשלום",
  customer_not_enabled: "החשבון אינו פעיל בספק",
  policy_violation: "הפרת מדיניות פרסום",
  webhook_unauthorized: "Webhook לא מאומת",
};

export async function fireIntegrationAlert(input: FireIntegrationAlertInput): Promise<{ fired: boolean; reason?: string }> {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  const throttleHours = input.throttleHours ?? 6;
  const triggerType = input.alert_type === "blocked"
    ? "ad_account_blocked"
    : input.alert_type === "reconnected"
      ? "integration_reconnected"
      : "integration_disconnected";

  try {
    // Throttle check
    if (throttleHours > 0) {
      const since = new Date(Date.now() - throttleHours * 3600 * 1000).toISOString();
      let q = supabase
        .from("integration_alerts_log")
        .select("id")
        .eq("tenant_id", input.tenant_id)
        .eq("provider", input.provider)
        .eq("alert_type", input.alert_type)
        .gte("fired_at", since)
        .limit(1);
      if (input.account_id) q = q.eq("account_id", input.account_id);
      else q = q.is("account_id", null);
      const { data: recent } = await q;
      if (recent && recent.length > 0) {
        return { fired: false, reason: "throttled" };
      }
    }

    // Resolve tenant + slug for internal link & display
    const { data: tenant } = await supabase
      .from("tenants")
      .select("id, name, slug")
      .eq("id", input.tenant_id)
      .maybeSingle();

    const provider_label = providerLabel(input.provider);
    const reason = input.reason ?? "";
    const reason_he = REASON_HE[reason.toLowerCase()] ?? reason ?? "סיבה לא ידועה";
    const account_link = accountLink(input.provider, input.account_id);
    const internal_link = internalLinkFor(input.provider, tenant?.slug ?? null);
    const occurred_at = new Date().toISOString();

    const data = {
      provider: input.provider,
      provider_label,
      alert_type: input.alert_type,
      reason,
      reason_he,
      account_id: input.account_id ?? "",
      account_name: input.account_name ?? "",
      client_id: input.client_id ?? "",
      client_name: input.client_name ?? "",
      tenant_name: tenant?.name ?? "",
      account_link,
      internal_link,
      occurred_at,
    };

    // Fire automation trigger
    await fetch(`${SUPABASE_URL}/functions/v1/trigger-automation`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_ROLE}`,
      },
      body: JSON.stringify({
        trigger_type: triggerType,
        tenant_id: input.tenant_id,
        data,
      }),
    }).catch((e) => console.error("[fireIntegrationAlert] trigger-automation failed:", e?.message));

    // Log
    await supabase.from("integration_alerts_log").insert({
      tenant_id: input.tenant_id,
      provider: input.provider,
      account_id: input.account_id ?? null,
      alert_type: input.alert_type,
      reason,
      payload: data,
    });

    return { fired: true };
  } catch (e: any) {
    console.error("[fireIntegrationAlert] failed:", e?.message);
    return { fired: false, reason: e?.message };
  }
}
