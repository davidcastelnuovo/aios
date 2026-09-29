/**
 * Signal → Playbook execution (general ops framework).
 * @see docs/client-ops-signal-framework.md
 */

export const CLIENT_OPS_SIGNAL_KINDS = [
  "comms.group_client_unanswered",
  "comms.group_staff_commitment_unfulfilled",
  "comms.card_weekly_missing_from_group",
  "performance.critical_campaign_alert",
  "performance.pulse_degraded",
  "relationship.client_call_stale",
] as const;

export type ClientOpsSignalKind = (typeof CLIENT_OPS_SIGNAL_KINDS)[number];

export type AssigneePolicy = {
  strategy: "client_primary_campaigner" | "user_email" | "none";
  email?: string;
};

export type PlaybookRow = {
  id: string;
  tenant_id: string;
  signal_kind: string;
  name: string;
  enabled: boolean;
  auto_execute: boolean;
  assignee_policy: AssigneePolicy;
  task_template: { title?: string; notes?: string };
  verification_plan: Array<Record<string, unknown>>;
  carmen_guidance?: string | null;
};

export function renderTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? "");
}

export function buildProblemSummary(
  signalKind: ClientOpsSignalKind,
  evidence: Record<string, unknown>,
): string {
  switch (signalKind) {
    case "comms.group_client_unanswered":
      return `שאלה בקבוצה ללא מענה (${evidence.waiting_hours ?? "?"} שע׳)`;
    case "comms.group_staff_commitment_unfulfilled":
      return "הובטחה פעולה בקבוצה — לא זוהה סגירה";
    case "comms.card_weekly_missing_from_group":
      return "עדכון שבועי בקבוצה — חסר בכרטיס";
    case "performance.critical_campaign_alert":
      return "התראות קמפיין קריטיות פתוחות";
    case "performance.pulse_degraded":
      return `דופק ${evidence.pulse_status ?? "degraded"}`;
    case "relationship.client_call_stale":
      return "אין שיחת לקוח מתועדת ב-14 יום";
    default:
      return "חריגת תפעול ללקוח";
  }
}

export function buildProblemDetail(
  signalKind: ClientOpsSignalKind,
  evidence: Record<string, unknown>,
): string {
  const excerpt = String(evidence.excerpt || evidence.message_excerpt || "").slice(0, 500);
  if (excerpt) return `«${excerpt}»\n(message_at: ${evidence.message_at ?? "—"})`;
  if (signalKind === "performance.critical_campaign_alert") {
    return `alert_ids: ${JSON.stringify(evidence.alert_ids ?? [])}`;
  }
  if (signalKind === "performance.pulse_degraded") {
    return `flags: ${JSON.stringify(evidence.flags ?? [])}`;
  }
  return JSON.stringify(evidence).slice(0, 800);
}

export async function loadPlaybookForSignal(
  supabase: { from: (t: string) => any },
  tenantId: string,
  signalKind: string,
): Promise<PlaybookRow | null> {
  const { data, error } = await supabase
    .from("client_ops_playbooks")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("signal_kind", signalKind)
    .eq("enabled", true)
    .maybeSingle();
  if (error) {
    if (/client_ops_playbooks/.test(error.message)) return null;
    throw error;
  }
  return data as PlaybookRow | null;
}

export async function resolveCampaignerForClient(
  supabase: { from: (t: string) => any },
  tenantId: string,
  clientId: string,
  policy: AssigneePolicy,
): Promise<string | null> {
  if (policy.strategy === "none") return null;
  if (policy.strategy === "user_email" && policy.email) {
    const { data: prof } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", policy.email)
      .maybeSingle();
    if (!prof?.id) return null;
    const { data: camp } = await supabase
      .from("campaigners")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("user_id", prof.id)
      .maybeSingle();
    return camp?.id ?? null;
  }
  const { data: link } = await supabase
    .from("client_team")
    .select("campaigner_id")
    .eq("client_id", clientId)
    .limit(1)
    .maybeSingle();
  return link?.campaigner_id ?? null;
}

export async function resolveAgencyForClient(
  supabase: { from: (t: string) => any },
  tenantId: string,
  clientId: string,
): Promise<string | null> {
  const { data: client } = await supabase
    .from("clients")
    .select("agency_id")
    .eq("id", clientId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (client?.agency_id) return client.agency_id;
  const { data: def } = await supabase
    .from("agencies")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("is_default", true)
    .limit(1)
    .maybeSingle();
  return def?.id ?? null;
}

export async function executeClientOpsPlaybook(
  supabase: { from: (t: string) => any },
  args: {
    tenantId: string;
    clientId: string;
    clientName: string;
    recommendationId: string;
    signalKind: string;
    problemSummary: string;
    evidence: Record<string, unknown>;
    verificationPlan: Array<Record<string, unknown>>;
    assigneePolicy: AssigneePolicy;
    taskTemplate: { title?: string; notes?: string };
    actorUserId?: string | null;
    dryRun?: boolean;
  },
): Promise<Record<string, unknown>> {
  const vars = {
    client_name: args.clientName,
    problem_summary: args.problemSummary,
    problem_detail: buildProblemDetail(args.signalKind as ClientOpsSignalKind, args.evidence),
  };
  const title = renderTemplate(args.taskTemplate.title || "{{client_name}}: {{problem_summary}}", vars)
    .slice(0, 200);
  const notes =
    renderTemplate(args.taskTemplate.notes || "{{problem_detail}}", vars).slice(0, 4000) +
    "\n\n[Client Ops playbook · signal=" + args.signalKind + "]";

  const campaignerId = await resolveCampaignerForClient(
    supabase,
    args.tenantId,
    args.clientId,
    args.assigneePolicy,
  );
  const agencyId = await resolveAgencyForClient(supabase, args.tenantId, args.clientId);

  if (args.dryRun) {
    return {
      ok: true,
      dry_run: true,
      title,
      notes_preview: notes.slice(0, 500),
      campaigner_id: campaignerId,
      signal_kind: args.signalKind,
    };
  }

  const { data: task, error: taskErr } = await supabase
    .from("tasks")
    .insert({
      tenant_id: args.tenantId,
      client_id: args.clientId,
      agency_id: agencyId,
      campaigner_id: campaignerId,
      title,
      notes,
      status: "open",
      priority: 7,
      task_type: "other",
      created_by: args.actorUserId ?? null,
    })
    .select("id")
    .single();
  if (taskErr) throw taskErr;

  await supabase.from("client_updates").insert({
    client_id: args.clientId,
    tenant_id: args.tenantId,
    user_id: args.actorUserId ?? null,
    content: `[תפעול · ${args.problemSummary}]\n${notes.slice(0, 1500)}`,
    update_type: "note",
  });

  const { error: recErr } = await supabase
    .from("client_operation_recommendations")
    .update({
      linked_task_id: task.id,
      status: "accepted",
      assignee_policy: args.assigneePolicy,
      verification_plan: args.verificationPlan,
      updated_at: new Date().toISOString(),
    })
    .eq("id", args.recommendationId)
    .eq("tenant_id", args.tenantId);
  if (recErr) throw recErr;

  return {
    ok: true,
    task_id: task.id,
    campaigner_id: campaignerId,
    signal_kind: args.signalKind,
    verification_plan: args.verificationPlan,
  };
}

export async function runClientOperationVerification(
  supabase: { from: (t: string) => any },
  args: {
    tenantId: string;
    clientId: string;
    signalKind: string;
    evidence: Record<string, unknown>;
    verificationPlan: Array<Record<string, unknown>>;
  },
): Promise<{ passed: boolean; checks: Array<Record<string, unknown>> }> {
  const checks: Array<Record<string, unknown>> = [];
  let allPassed = true;

  for (const step of args.verificationPlan || []) {
    const type = String(step.type || "");
    const id = String(step.id || type);
    let passed = false;
    let detail: Record<string, unknown> = {};

    if (type === "pulse_status") {
      const maxStatus = String((step.params as Record<string, unknown>)?.max_status || "warning");
      const { data: pulse } = await supabase
        .from("campaign_pulse_snapshots")
        .select("status, calculated_at, flags")
        .eq("client_id", args.clientId)
        .order("calculated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const st = String(pulse?.status || "no_data");
      const order = ["no_data", "ok", "warning", "critical"];
      passed = order.indexOf(st) <= order.indexOf(maxStatus);
      detail = { pulse_status: st, flags: pulse?.flags };
    } else if (type === "green_group_reply_after") {
      const messageAt = String(args.evidence.message_at || "");
      const comm = await import("./client-green-group-monitor.ts").then((m) =>
        m.fetchClientGreenApiGroupCommunications(supabase, {
          tenantId: args.tenantId,
          clientId: args.clientId,
          daysBack: 14,
        })
      );
      const stillUnanswered = comm.unanswered_client_questions.some(
        (u) => u.message_at === messageAt,
      );
      passed = !stillUnanswered;
      detail = { still_unanswered: stillUnanswered };
    } else if (type === "green_group_commitment_closed") {
      const messageAt = String(args.evidence.message_at || "");
      const comm = await import("./client-green-group-monitor.ts").then((m) =>
        m.fetchClientGreenApiGroupCommunications(supabase, {
          tenantId: args.tenantId,
          clientId: args.clientId,
          daysBack: 14,
        })
      );
      const stillOpen = comm.unfulfilled_staff_commitments.some(
        (c) => c.message_at === messageAt,
      );
      passed = !stillOpen;
      detail = { still_unfulfilled: stillOpen };
    } else if (type === "open_task_exists") {
      const { count } = await supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", args.tenantId)
        .eq("client_id", args.clientId)
        .in("status", ["open", "in_progress"]);
      passed = (count ?? 0) > 0;
      detail = { open_tasks: count };
    } else if (type === "client_call_logged_since") {
      const days = Number((step.params as Record<string, unknown>)?.days || 14);
      const since = new Date(Date.now() - days * 86400_000).toISOString();
      const { data: pulse } = await supabase
        .from("campaign_pulse_snapshots")
        .select("last_client_call_at")
        .eq("client_id", args.clientId)
        .order("calculated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      passed = Boolean(pulse?.last_client_call_at && pulse.last_client_call_at >= since);
      detail = { last_client_call_at: pulse?.last_client_call_at };
    } else if (type === "client_weekly_update_since") {
      const days = Number((step.params as Record<string, unknown>)?.days || 7);
      const since = new Date(Date.now() - days * 86400_000).toISOString();
      const { count } = await supabase
        .from("client_updates")
        .select("id", { count: "exact", head: true })
        .eq("client_id", args.clientId)
        .eq("update_type", "weekly_update")
        .gte("created_at", since);
      passed = (count ?? 0) > 0;
      detail = { weekly_updates: count };
    } else if (type === "critical_alerts_cleared") {
      const { count } = await supabase
        .from("campaign_alerts")
        .select("id", { count: "exact", head: true })
        .eq("client_id", args.clientId)
        .eq("severity", "critical")
        .is("resolved_at", null);
      passed = (count ?? 0) === 0;
      detail = { open_critical: count };
    } else {
      passed = false;
      detail = { error: "unknown_check_type" };
    }

    checks.push({ id, type, passed, detail });
    if (!passed) allPassed = false;
  }

  return { passed: allPassed, checks };
}

export async function autoExecutePlaybooksForOpenRecommendations(
  supabase: { from: (t: string) => any },
  args: { tenantId: string; clientId: string; clientName: string; actorUserId?: string | null },
): Promise<{ executed: number }> {
  const { data: recs, error } = await supabase
    .from("client_operation_recommendations")
    .select("*")
    .eq("tenant_id", args.tenantId)
    .eq("client_id", args.clientId)
    .eq("status", "open")
    .is("linked_task_id", null)
    .not("signal_kind", "is", null);
  if (error) {
    if (/signal_kind|client_ops_playbooks/.test(error.message)) return { executed: 0 };
    throw error;
  }

  let executed = 0;
  for (const rec of recs || []) {
    const playbook = await loadPlaybookForSignal(supabase, args.tenantId, rec.signal_kind);
    if (!playbook?.auto_execute) continue;
    await executeClientOpsPlaybook(supabase, {
      tenantId: args.tenantId,
      clientId: args.clientId,
      clientName: args.clientName,
      recommendationId: rec.id,
      signalKind: rec.signal_kind,
      problemSummary: rec.problem_summary || rec.title,
      evidence: (rec.evidence as Record<string, unknown>) || {},
      verificationPlan: playbook.verification_plan || [],
      assigneePolicy: playbook.assignee_policy,
      taskTemplate: playbook.task_template || {},
      actorUserId: args.actorUserId,
    });
    executed++;
  }
  return { executed };
}
