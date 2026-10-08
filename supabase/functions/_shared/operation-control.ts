/** COCL Phase 1a — plans, runs, dev dispatch materialization. */

export type OperationRollup = "on_track" | "needs_attention" | "complete";

export type DevDispatchRunInput = {
  tenantId: string;
  devTaskId: string;
  taskTitle: string;
  delivered: boolean;
  verificationFailed?: boolean;
  reconciled?: boolean;
  reconciliationSource?: string;
  sessionUrl?: string;
  cursorAgentId?: string;
  dispatchToolError?: string | null;
  actorUserId?: string | null;
  dispatchedAt?: string;
};

export function devDispatchIdempotencyKey(tenantId: string, devTaskId: string): string {
  return `${tenantId}:dev_task:${devTaskId}`;
}

export function mapDevDispatchToRunFields(input: DevDispatchRunInput): {
  status: string;
  rollup_status: OperationRollup;
  verification_status: "pending" | "passed" | "failed" | "skipped";
  exception_count: number;
  summary: string;
} {
  const { delivered, verificationFailed, reconciled } = input;
  if (verificationFailed && !delivered) {
    return {
      status: "exception",
      rollup_status: "needs_attention",
      verification_status: "failed",
      exception_count: 1,
      summary: "לא אומתה מסירה ל-Cursor",
    };
  }
  if (delivered && reconciled) {
    return {
      status: "verified",
      rollup_status: "on_track",
      verification_status: "passed",
      exception_count: 0,
      summary: "נשלח ל-Cursor (אימות לאחר reconcile)",
    };
  }
  if (delivered) {
    return {
      status: "executed",
      rollup_status: "on_track",
      verification_status: "passed",
      exception_count: 0,
      summary: "נשלח ל-Cursor",
    };
  }
  return {
    status: "failed",
    rollup_status: "needs_attention",
    verification_status: "failed",
    exception_count: 1,
    summary: "Dispatch נכשל",
  };
}

export async function ensureDevDispatchPlan(
  supabase: { from: (t: string) => any },
  tenantId: string,
): Promise<string> {
  const slug = "dev_task_dispatch";
  const { data: existing } = await supabase
    .from("operation_plans")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("slug", slug)
    .maybeSingle();
  if (existing?.id) return existing.id as string;

  const { data, error } = await supabase
    .from("operation_plans")
    .insert({
      tenant_id: tenantId,
      slug,
      name: "משימות פיתוח → Cursor",
      operation_type: "dev_dispatch",
      scope_json: { version: 1, action: { type: "custom", mutates_platform: false } },
      schedule_json: {},
      approval_policy: "human_required",
      reporting_policy: { channels: ["command_center"], exception_first: true },
      enabled: true,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function recordDevDispatchOperationRun(
  supabase: { from: (t: string) => any },
  input: DevDispatchRunInput,
): Promise<{ run_id: string; created: boolean }> {
  const idempotencyKey = devDispatchIdempotencyKey(input.tenantId, input.devTaskId);
  const { data: existing } = await supabase
    .from("operation_runs")
    .select("id")
    .eq("tenant_id", input.tenantId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (existing?.id) {
    await patchDevDispatchRun(supabase, existing.id as string, input);
    return { run_id: existing.id as string, created: false };
  }

  const planId = await ensureDevDispatchPlan(supabase, input.tenantId);
  const mapped = mapDevDispatchToRunFields(input);
  const now = input.dispatchedAt || new Date().toISOString();

  const { data: snap, error: snapErr } = await supabase
    .from("operation_scope_snapshots")
    .insert({
      tenant_id: input.tenantId,
      scope_json: {
        version: 1,
        tenant_id: input.tenantId,
        dev_task_id: input.devTaskId,
        action: { type: "dev_dispatch", mutates_platform: false },
      },
    })
    .select("id")
    .single();
  if (snapErr) throw snapErr;

  const { data: run, error: runErr } = await supabase
    .from("operation_runs")
    .insert({
      tenant_id: input.tenantId,
      plan_id: planId,
      status: mapped.status,
      rollup_status: mapped.rollup_status,
      planned_at: now,
      started_at: now,
      finished_at: now,
      trigger_source: "executor",
      executor_ref: { type: "dev_task", id: input.devTaskId },
      scope_snapshot_id: snap.id,
      verification_status: mapped.verification_status,
      exception_count: mapped.exception_count,
      idempotency_key: idempotencyKey,
      title: input.taskTitle,
      summary: mapped.summary,
      dev_task_id: input.devTaskId,
      metadata: {
        session_url: input.sessionUrl || null,
        cursor_agent_id: input.cursorAgentId || null,
        reconciled: input.reconciled || false,
        reconciliation_source: input.reconciliationSource || null,
      },
    })
    .select("id")
    .single();
  if (runErr) throw runErr;

  await appendRunEvent(supabase, {
    tenantId: input.tenantId,
    runId: run.id as string,
    eventType: input.delivered ? "executor_finished" : "exception_opened",
    detail: {
      delivered: input.delivered,
      verificationFailed: input.verificationFailed,
      reconciled: input.reconciled,
      dispatchToolError: input.dispatchToolError,
      sessionUrl: input.sessionUrl,
    },
    actorUserId: input.actorUserId,
  });
  if (input.reconciled) {
    await appendRunEvent(supabase, {
      tenantId: input.tenantId,
      runId: run.id as string,
      eventType: "reconciled",
      detail: { source: input.reconciliationSource },
      actorUserId: input.actorUserId,
    });
  }

  await supabase.from("operation_verifications").upsert({
    tenant_id: input.tenantId,
    operation_run_id: run.id,
    status: mapped.verification_status,
    checks: [{
      id: "cursor_session_delivered",
      passed: input.delivered && !input.verificationFailed,
      severity: input.verificationFailed ? "critical" : "info",
      actual: {
        delivered: input.delivered,
        reconciled: input.reconciled,
        session_url: input.sessionUrl,
      },
    }],
    summary: mapped.summary,
  }, { onConflict: "operation_run_id" });

  return { run_id: run.id as string, created: true };
}

async function patchDevDispatchRun(
  supabase: { from: (t: string) => any },
  runId: string,
  input: DevDispatchRunInput,
): Promise<void> {
  const mapped = mapDevDispatchToRunFields(input);
  await supabase
    .from("operation_runs")
    .update({
      status: mapped.status,
      rollup_status: mapped.rollup_status,
      verification_status: mapped.verification_status,
      exception_count: mapped.exception_count,
      summary: mapped.summary,
      finished_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      metadata: {
        session_url: input.sessionUrl || null,
        cursor_agent_id: input.cursorAgentId || null,
        reconciled: input.reconciled || false,
        reconciliation_source: input.reconciliationSource || null,
      },
    })
    .eq("id", runId)
    .eq("tenant_id", input.tenantId);
}

export async function appendRunEvent(
  supabase: { from: (t: string) => any },
  args: {
    tenantId: string;
    runId: string;
    eventType: string;
    detail?: Record<string, unknown>;
    actorUserId?: string | null;
  },
): Promise<void> {
  const { error } = await supabase.from("operation_run_events").insert({
    tenant_id: args.tenantId,
    operation_run_id: args.runId,
    event_type: args.eventType,
    detail: args.detail || {},
    actor_user_id: args.actorUserId || null,
  });
  if (error) throw error;
}

export async function listOperationRuns(
  supabase: { from: (t: string) => any },
  args: {
    tenantId: string;
    limit?: number;
    exceptionOnly?: boolean;
    sinceIso?: string;
    operationType?: string;
  },
) {
  let q = supabase
    .from("operation_runs")
    .select("*, operation_plans(operation_type, slug, name)")
    .eq("tenant_id", args.tenantId)
    .order("planned_at", { ascending: false });
  if (args.exceptionOnly) {
    q = q.or("rollup_status.eq.needs_attention,exception_count.gt.0");
  }
  if (args.sinceIso) q = q.gte("planned_at", args.sinceIso);
  const lim = Math.min(args.limit || 40, 100);
  const { data, error } = await q.limit(lim);
  if (error) throw error;
  let rows = data || [];
  if (args.operationType) {
    rows = rows.filter(
      (r: { operation_plans?: { operation_type?: string } | null }) =>
        r.operation_plans?.operation_type === args.operationType,
    );
  }
  return rows;
}

export async function getOperationRunDetail(
  supabase: { from: (t: string) => any },
  tenantId: string,
  runId: string,
) {
  const { data: run, error } = await supabase
    .from("operation_runs")
    .select("*, operation_plans(*)")
    .eq("tenant_id", tenantId)
    .eq("id", runId)
    .maybeSingle();
  if (error) throw error;
  if (!run) return null;
  const [{ data: events }, { data: verification }, { data: reports }] = await Promise.all([
    supabase.from("operation_run_events").select("*").eq("operation_run_id", runId).order("created_at", { ascending: true }),
    supabase.from("operation_verifications").select("*").eq("operation_run_id", runId).maybeSingle(),
    supabase.from("operation_reports").select("*").eq("operation_run_id", runId).order("created_at", { ascending: false }).limit(10),
  ]);
  return { run, events: events || [], verification, reports: reports || [] };
}

/** Backfill COCL runs from dev_tasks that already have dispatched_at (forward-only helper). */
export async function syncDevTaskRunsFromTable(
  supabase: { from: (t: string) => any },
  tenantId: string,
  limit = 30,
): Promise<{ synced: number }> {
  const { data: tasks, error } = await supabase
    .from("dev_tasks")
    .select("id, title, tenant_id, dispatched_at, cursor_session_url, cursor_session_id, dispatch_error, status")
    .eq("tenant_id", tenantId)
    .not("dispatched_at", "is", null)
    .order("dispatched_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  let synced = 0;
  for (const t of tasks || []) {
    const err = String(t.dispatch_error || "");
    const delivered = Boolean(t.cursor_session_id) || t.status === "sent_to_cursor";
    const verificationFailed = /verificationFailed|dispatch_failed/i.test(err) && !delivered;
    const reconciled = err.includes("[verified_delivered]");
    await recordDevDispatchOperationRun(supabase, {
      tenantId,
      devTaskId: t.id,
      taskTitle: t.title,
      delivered,
      verificationFailed,
      reconciled,
      sessionUrl: t.cursor_session_url,
      cursorAgentId: t.cursor_session_id,
      dispatchToolError: err || null,
      dispatchedAt: t.dispatched_at,
    });
    synced += 1;
  }
  return { synced };
}
