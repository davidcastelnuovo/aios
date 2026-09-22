/**
 * Client Operations Intelligence — package builder + rule-based recommendations.
 * Spec: docs/campaign-operations-control-layer.md §22
 */

import { CLIENT_CALL_STALE_MS, PULSE_CRITICAL_ALERT_TYPES } from "./campaign-pulse.ts";
import { fetchClientGreenApiGroupCommunications } from "./client-green-group-monitor.ts";

export type RecommendationDraft = {
  recommendation_type: string;
  severity: "info" | "warning" | "critical";
  title: string;
  body: string;
  evidence: Record<string, unknown>;
  requires_approval: boolean;
  suggested_tool?: string;
  fingerprint: string;
};

export type PulseRowLike = {
  status?: string | null;
  calculated_at?: string | null;
  last_client_call_at?: string | null;
  last_client_call_by?: string | null;
  flags?: string[] | null;
  lead_goal_status?: string | null;
  ecommerce_goal_status?: string | null;
  cpl_7d?: number | null;
  roas_7d?: number | null;
};

export type AlertLike = {
  id: string;
  alert_type?: string | null;
  severity?: string | null;
  campaign_name?: string | null;
  created_at?: string | null;
};

/** Deterministic rules — no LLM. */
export function deriveClientRecommendationDrafts(input: {
  clientId: string;
  clientName: string;
  pulse: PulseRowLike | null;
  openAlerts: AlertLike[];
  unansweredGreenGroupQuestions?: Array<{ excerpt: string; waiting_hours: number; message_at: string }>;
  nowMs?: number;
}): RecommendationDraft[] {
  const now = input.nowMs ?? Date.now();
  const out: RecommendationDraft[] = [];
  const name = input.clientName || "לקוח";

  const criticalAlerts = input.openAlerts.filter((a) =>
    a.severity === "critical" ||
    PULSE_CRITICAL_ALERT_TYPES.includes((a.alert_type || "") as typeof PULSE_CRITICAL_ALERT_TYPES[number])
  );

  if (criticalAlerts.length > 0) {
    out.push({
      recommendation_type: "handle_critical_alert",
      severity: "critical",
      title: `${name}: ${criticalAlerts.length} התראות קריטיות פתוחות`,
      body: "יש לטפל בקמפיין/מודעה לפני המשך — אין לדווח «הכול תקין».",
      evidence: {
        alert_ids: criticalAlerts.map((a) => a.id),
        alert_types: criticalAlerts.map((a) => a.alert_type),
      },
      requires_approval: false,
      suggested_tool: "get_campaign_alerts",
      fingerprint: `critical_alerts:${criticalAlerts.map((a) => a.id).sort().join(",")}`.slice(0, 200),
    });
  }

  const pulse = input.pulse;
  if (pulse?.status === "critical") {
    out.push({
      recommendation_type: "review_pulse",
      severity: "critical",
      title: `${name}: דופק במצב critical`,
      body: "לפתוח פירוט בדשבורד או get_latest_campaign_pulse; אין להריץ analyze אוטומטית.",
      evidence: { pulse_status: pulse.status, calculated_at: pulse.calculated_at, flags: pulse.flags || [] },
      requires_approval: false,
      suggested_tool: "get_latest_campaign_pulse",
      fingerprint: `pulse_critical:${pulse.calculated_at || "unknown"}`,
    });
  } else if (pulse?.status === "warning") {
    out.push({
      recommendation_type: "review_pulse",
      severity: "warning",
      title: `${name}: דופק warning — כדאי לבדוק`,
      body: "סקירת flags ומגמה; אופטימיזציה/שינוי תקציב רק באישור.",
      evidence: { pulse_status: pulse.status, flags: pulse.flags || [] },
      requires_approval: false,
      suggested_tool: "get_latest_campaign_pulse",
      fingerprint: `pulse_warning:${(pulse.flags || []).join("|")}`.slice(0, 200),
    });
  }

  for (const u of input.unansweredGreenGroupQuestions || []) {
    out.push({
      recommendation_type: "notify_staff",
      severity: u.waiting_hours >= 24 ? "critical" : "warning",
      title: `${name}: שאלה בקבוצת Green API בלי מענה (${u.waiting_hours} שע׳)`,
      body: `לקוח/איש קשר שאל בקבוצה CRM ולא נרשם מענה מהצוות: «${u.excerpt.slice(0, 120)}» — לדווח לקמפיינר/דוד; לא לשלוח לקבוצה אוטומטית.`,
      evidence: { message_at: u.message_at, waiting_hours: u.waiting_hours, excerpt: u.excerpt },
      requires_approval: false,
      suggested_tool: "get_client_green_group_communications",
      fingerprint: `green_unanswered:${u.message_at}:${u.excerpt.slice(0, 40)}`.slice(0, 200),
    });
  }

  if (pulse && pulse.status !== "no_data") {
    const callAt = pulse.last_client_call_at ? new Date(pulse.last_client_call_at).getTime() : NaN;
    const staleCall = !pulse.last_client_call_at || Number.isNaN(callAt) || (now - callAt > CLIENT_CALL_STALE_MS);
    if (staleCall) {
      out.push({
        recommendation_type: "contact_client",
        severity: pulse.status === "critical" ? "critical" : "warning",
        title: `${name}: אין שיחת טלפון מתועדת ב-14 יום`,
        body: "לתאם שיחה עם הלקוח או לרשום call בכרטיס; במקביל לבדוק ביצועי קמפיין.",
        evidence: {
          last_client_call_at: pulse.last_client_call_at,
          last_client_call_by: pulse.last_client_call_by,
        },
        requires_approval: false,
        suggested_tool: "add_client_update",
        fingerprint: "stale_client_call:14d",
      });
    }
  }

  return out;
}

export async function upsertRecommendationDrafts(
  supabase: { from: (t: string) => any },
  args: { tenantId: string; clientId: string; drafts: RecommendationDraft[] },
): Promise<{ inserted: number; updated: number }> {
  let inserted = 0;
  let updated = 0;
  for (const d of args.drafts) {
    const { data: existing } = await supabase
      .from("client_operation_recommendations")
      .select("id")
      .eq("tenant_id", args.tenantId)
      .eq("client_id", args.clientId)
      .eq("fingerprint", d.fingerprint)
      .eq("status", "open")
      .maybeSingle();

    const row = {
      tenant_id: args.tenantId,
      client_id: args.clientId,
      recommendation_type: d.recommendation_type,
      severity: d.severity,
      title: d.title,
      body: d.body,
      evidence: d.evidence,
      requires_approval: d.requires_approval,
      suggested_tool: d.suggested_tool ?? null,
      fingerprint: d.fingerprint,
      updated_at: new Date().toISOString(),
    };

    if (existing?.id) {
      await supabase.from("client_operation_recommendations").update(row).eq("id", existing.id);
      updated++;
    } else {
      await supabase.from("client_operation_recommendations").insert(row);
      inserted++;
    }
  }
  return { inserted, updated };
}

export async function fetchClientLinkedGroupMessages(
  supabase: { from: (t: string) => any },
  args: { tenantId: string; clientId: string; daysBack?: number; limit?: number },
): Promise<Array<{ when: string; direction: string; from: string; text: string; group_name: string | null }>> {
  const days = Math.min(args.daysBack ?? 14, 60);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const limit = Math.min(args.limit ?? 12, 30);

  const { data: links } = await supabase
    .from("carmen_client_group_access")
    .select("whatsapp_group_id, whatsapp_groups(group_name, group_chat_id)")
    .eq("tenant_id", args.tenantId)
    .eq("client_id", args.clientId);

  const groupIds = (links || []).map((l: any) => l.whatsapp_group_id).filter(Boolean);
  if (!groupIds.length) return [];

  const { data: groups } = await supabase
    .from("whatsapp_groups")
    .select("id, group_name")
    .in("id", groupIds);
  const groupNameById = new Map((groups || []).map((g: any) => [g.id, g.group_name]));

  const { data: messages, error } = await supabase
    .from("chat_messages")
    .select("message_text, direction, sender_name, sender_phone, created_at, group_id")
    .eq("tenant_id", args.tenantId)
    .eq("provider", "manus_wa")
    .in("group_id", groupIds)
    .gte("created_at", since)
    .not("message_text", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.warn("[client-operations] group messages:", error.message);
    return [];
  }

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem", dateStyle: "short", timeStyle: "short" });

  return (messages || []).reverse().map((m: any) => ({
    when: fmt(m.created_at),
    direction: m.direction,
    from: m.sender_name || m.sender_phone || "",
    text: String(m.message_text || "").slice(0, 500),
    group_name: groupNameById.get(m.group_id) || null,
  }));
}

export async function buildClientOperationsPackage(
  supabase: { from: (t: string) => any; rpc?: (name: string, args: Record<string, unknown>) => any },
  args: {
    tenantId: string;
    clientId: string;
    accessibleTenantIds: string[];
    refreshRecommendations?: boolean;
  },
) {
  const { tenantId, clientId, accessibleTenantIds } = args;

  const { data: client, error: clientErr } = await supabase
    .from("clients")
    .select("id, name, status, mood_status, phone, contact_name, agency_id, meta_ads_account_id, agencies(name)")
    .eq("id", clientId)
    .in("tenant_id", accessibleTenantIds)
    .maybeSingle();
  if (clientErr) throw clientErr;
  if (!client) return { error: "client_not_found" };

  const pulseCols =
    "client_id, status, calculated_at, data_fresh_through, flags, last_client_call_at, last_client_call_by, lead_goal_status, ecommerce_goal_status, cpl_7d, roas_7d, spend_7d";
  const { data: pulseRows } = await supabase
    .from("campaign_pulse_snapshots")
    .select(pulseCols)
    .eq("client_id", clientId)
    .in("tenant_id", accessibleTenantIds)
    .order("calculated_at", { ascending: false })
    .limit(1);
  const pulse = pulseRows?.[0] || null;

  const { data: alerts } = await supabase
    .from("campaign_alerts")
    .select("id, alert_type, severity, campaign_name, created_at")
    .eq("client_id", clientId)
    .in("tenant_id", accessibleTenantIds)
    .is("resolved_at", null)
    .order("created_at", { ascending: false })
    .limit(20);

  const { data: updates } = await supabase
    .from("client_updates")
    .select("id, content, update_type, created_at, user_id")
    .eq("client_id", clientId)
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(8);

  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, title, status, due_date, priority")
    .eq("client_id", clientId)
    .in("tenant_id", accessibleTenantIds)
    .in("status", ["open", "in_progress"])
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(10);

  const group_messages = await fetchClientLinkedGroupMessages(supabase, { tenantId, clientId });
  const green_api_group = await fetchClientGreenApiGroupCommunications(supabase, {
    tenantId,
    clientId,
    daysBack: 7,
  });

  let recommendation_sync: { inserted: number; updated: number } | undefined;
  let recommendationsAvailable = true;
  let sortedRecs: any[] = [];

  try {
    if (args.refreshRecommendations !== false) {
      const drafts = deriveClientRecommendationDrafts({
        clientId,
        clientName: client.name,
        pulse,
        openAlerts: alerts || [],
        unansweredGreenGroupQuestions: green_api_group.unanswered_client_questions,
      });
      recommendation_sync = await upsertRecommendationDrafts(supabase, {
        tenantId,
        clientId,
        drafts,
      });
    }

    const { data: recommendations, error: recErr } = await supabase
      .from("client_operation_recommendations")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("client_id", clientId)
      .eq("status", "open")
      .order("updated_at", { ascending: false });

    if (recErr) throw recErr;

    const severityRank = (s: string) => (s === "critical" ? 0 : s === "warning" ? 1 : 2);
    sortedRecs = (recommendations || []).sort(
      (a: any, b: any) => severityRank(a.severity) - severityRank(b.severity),
    );
  } catch (e: unknown) {
    recommendationsAvailable = false;
    console.warn("[client-operations] recommendations unavailable:", e);
  }

  return {
    client: {
      id: client.id,
      name: client.name,
      status: client.status,
      mood_status: client.mood_status,
      agency_name: client.agencies?.name ?? null,
      meta_connected: Boolean(client.meta_ads_account_id),
    },
    pulse: pulse
      ? {
          status: pulse.status,
          calculated_at: pulse.calculated_at,
          data_fresh_through: pulse.data_fresh_through,
          flags: pulse.flags || [],
          last_client_call_at: pulse.last_client_call_at,
          last_client_call_by: pulse.last_client_call_by,
          cpl_7d: pulse.cpl_7d,
          roas_7d: pulse.roas_7d,
          spend_7d: pulse.spend_7d,
        }
      : null,
    open_alerts: alerts || [],
    recent_card_updates: (updates || []).map((u: any) => ({
      id: u.id,
      update_type: u.update_type,
      content: String(u.content || "").slice(0, 400),
      created_at: u.created_at,
    })),
    open_tasks: tasks || [],
    group_messages,
    green_api_group,
    recommendations: sortedRecs,
    recommendations_available: recommendationsAvailable,
    recommendation_sync,
    summary: {
      open_recommendation_count: sortedRecs.length,
      critical_alerts: (alerts || []).filter((a: any) => a.severity === "critical").length,
      pulse_status: pulse?.status ?? "no_snapshot",
    },
  };
}
