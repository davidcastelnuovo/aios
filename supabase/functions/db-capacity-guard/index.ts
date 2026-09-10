import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import {
  buildCapacityWhatsApp,
  classifyPressure,
  extractComputeVariant,
  nextComputeVariant,
  shouldNotify,
  shouldScale,
  type ConnectionSnapshot,
  type PressureLevel,
} from "../_shared/db-capacity.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DAVID_TENANT = "6ad8f321-25db-4a04-8e44-e57a7c8961b2";
const COMPUTE_DASHBOARD = "https://supabase.com/dashboard/project/zvoijyneresvkadpprel/settings/compute-and-disk";

function projectRef(): string {
  const url = Deno.env.get("SUPABASE_URL") || "";
  const host = url.replace(/^https?:\/\//, "").split("/")[0];
  return host.split(".")[0] || "zvoijyneresvkadpprel";
}

function autoscaleEnabled(): boolean {
  const flag = (Deno.env.get("DB_AUTOSCALE_ENABLED") || "").toLowerCase();
  return flag === "1" || flag === "true" || flag === "yes";
}

function managementToken(): string | null {
  const token =
    Deno.env.get("SUPABASE_MANAGEMENT_TOKEN") ||
    Deno.env.get("BASE_ACCESS_TOKEN") ||
    "";
  return token.trim() || null;
}

function parseSnapshot(raw: unknown): ConnectionSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const used = Number(row.used);
  const max = Number(row.max);
  const usedPct = Number(row.used_pct);
  if (!Number.isFinite(used) || !Number.isFinite(max) || !Number.isFinite(usedPct)) return null;
  return {
    used,
    max,
    usable: Number(row.usable) || undefined,
    reserved: Number(row.reserved) || undefined,
    used_pct: usedPct,
    active: Number(row.active) || 0,
    idle: Number(row.idle) || 0,
    idle_in_transaction: Number(row.idle_in_transaction) || 0,
    waiting: Number(row.waiting) || 0,
    oldest_idle_seconds: Number(row.oldest_idle_seconds) || 0,
  };
}

async function readCurrentCompute(ref: string, token: string): Promise<string | null> {
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const urls = [
    `https://api.supabase.com/v1/projects/${ref}/billing/addons`,
    `https://api.supabase.com/v1/projects/${ref}`,
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url, { headers });
      if (!res.ok) continue;
      const variant = extractComputeVariant(await res.json());
      if (variant) return variant;
    } catch {
      // try next shape
    }
  }
  return null;
}

async function applyCompute(ref: string, token: string, variant: string): Promise<{ ok: boolean; detail: string }> {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/billing/addons`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ addon_type: "compute_instance", addon_variant: variant }),
  });
  const body = await res.text();
  return {
    ok: res.ok,
    detail: body.slice(0, 280) || `HTTP ${res.status}`,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const t0 = performance.now();
  const { data: pressureRaw, error: pressureError } = await supabase.rpc("db_connection_pressure");
  const latency = Math.round(performance.now() - t0);
  const snapshot = parseSnapshot(pressureRaw);
  const reachable = !pressureError && !!snapshot;
  const level: PressureLevel = classifyPressure(snapshot?.used_pct, reachable);

  const detail = reachable
    ? `${snapshot!.used}/${snapshot!.max} חיבורים (${Number(snapshot!.used_pct).toFixed(0)}%) · פעילים ${snapshot!.active} · ממתינים ${snapshot!.idle_in_transaction}`
    : (pressureError?.message || "db_connection_pressure failed").slice(0, 180);

  const { data: prev } = await supabase
    .from("service_health_checks")
    .select("status")
    .eq("service", "db_connections")
    .order("checked_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const previousLevel = (prev?.status as PressureLevel | undefined) ?? null;

  await supabase.from("service_health_checks").insert({
    tenant_id: null,
    service: "db_connections",
    status: level === "critical" ? "down" : level,
    latency_ms: latency,
    detail,
  });

  let relieved = 0;
  if (level === "critical" || level === "down") {
    const { data: relief } = await supabase.rpc("relieve_db_connection_pressure", {
      p_idle_seconds: 30,
      p_max_kill: 25,
    });
    relieved = Number((relief as { killed?: number } | null)?.killed ?? 0);
  }

  let scaledFrom: string | null = null;
  let scaledTo: string | null = null;
  let scaleBlockedReason: string | null = null;

  if (shouldScale(snapshot?.used_pct, reachable)) {
    const { data: claimedScale } = await supabase.rpc("claim_db_capacity_alert", {
      p_key: "scale",
      p_cooldown_minutes: 360,
    });
    if (claimedScale === true) {
      if (!autoscaleEnabled()) {
        scaleBlockedReason = `כדי לגדול לבד צריך DB_AUTOSCALE_ENABLED=true. בינתיים תעלה ידנית: ${COMPUTE_DASHBOARD}`;
      } else {
        const token = managementToken();
        if (!token) {
          scaleBlockedReason = `חסר SUPABASE_MANAGEMENT_TOKEN לצמיחה אוטומטית. תעלה ידנית: ${COMPUTE_DASHBOARD}`;
        } else {
          const ref = projectRef();
          scaledFrom = await readCurrentCompute(ref, token);
          const next = nextComputeVariant(scaledFrom, Deno.env.get("DB_AUTOSCALE_MAX_VARIANT") || undefined);
          if (!next) {
            scaleBlockedReason = `כבר בגודל המקסימלי המותר (${scaledFrom || "לא ידוע"}).`;
          } else {
            const applied = await applyCompute(ref, token, next);
            if (applied.ok) {
              scaledTo = next;
            } else {
              scaleBlockedReason = `ניסיון העלאה ל-${next} נכשל: ${applied.detail}`;
            }
          }
        }
      }
    }
  }

  const action = scaledTo ? "scale" : relieved > 0 ? "relieve" : "snapshot";
  await supabase.from("db_capacity_events").insert({
    level,
    action,
    used: snapshot?.used ?? null,
    max: snapshot?.max ?? null,
    used_pct: snapshot?.used_pct ?? null,
    detail: {
      relieved,
      scaledFrom,
      scaledTo,
      scaleBlockedReason,
      snapshot,
      error: pressureError?.message ?? null,
    },
  });

  const alertKey = level === "ok" ? "ok" : level === "warn" ? "warn" : "critical";
  const { data: claimed } = level === "ok"
    ? { data: false }
    : await supabase.rpc("claim_db_capacity_alert", {
      p_key: alertKey,
      p_cooldown_minutes: level === "warn" ? 30 : 15,
    });

  const notify = shouldNotify({
    level,
    previousLevel,
    claimed: claimed === true || !!scaledTo,
  }) || !!scaledTo || !!scaleBlockedReason;

  if (notify) {
    const message = buildCapacityWhatsApp({
      level: scaledTo ? "critical" : level,
      snapshot,
      relieved,
      scaledFrom,
      scaledTo,
      scaleBlockedReason,
    });
    await supabase.from("integration_alerts_log").insert({
      tenant_id: DAVID_TENANT,
      provider: "postgres",
      alert_type: scaledTo ? "db_capacity_scaled" : level === "ok" ? "reconnected" : level === "warn" ? "db_capacity_warn" : "db_capacity_critical",
      reason: message,
    });
    await supabase.rpc("claude_notify_david", {
      p_message: message,
    }).then(() => {}, (e: unknown) => console.error("[db-capacity-guard] notify failed", e));
  }

  return new Response(
    JSON.stringify({
      success: reachable,
      level,
      snapshot,
      relieved,
      scaledFrom,
      scaledTo,
      notified: notify,
    }),
    { status: reachable ? 200 : 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
