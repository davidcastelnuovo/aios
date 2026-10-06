/**
 * Carmen Autonomous Goal Engine — Phase 1
 * Goal Contract, persisted loop, Completion Gate, stuck detection.
 */

import { createUnifiedGoal, logGoalEvent } from "./goal-execution.ts";
import { modelRouterJSON, type ModelProfile } from "./model-router.ts";

export const ENGINE_STATUSES = [
  "PLANNING", "EXECUTING", "VERIFYING", "REPLANNING", "BLOCKED", "COMPLETED", "AWAITING_BRAIN",
] as const;
export type EngineStatus = typeof ENGINE_STATUSES[number];

export const CRITERION_STATUSES = ["PASS", "FAIL", "UNKNOWN", "NOT_TESTED"] as const;
export type CriterionStatus = typeof CRITERION_STATUSES[number];

export const RISK_LEVELS = ["READ", "SAFE_WRITE", "REVERSIBLE", "PRODUCTION", "DESTRUCTIVE"] as const;
export type RiskLevel = typeof RISK_LEVELS[number];

export type SuccessCriterionInput = {
  key?: string;
  description: string;
  required?: boolean;
  verification_type?: string;
  verification_config?: Record<string, unknown>;
  evidence_required?: string;
};

export type AutonomousGoalRow = {
  id: string;
  tenant_id: string;
  title: string;
  description?: string | null;
  objective?: string | null;
  status: string;
  engine_status: EngineStatus;
  autonomous_mode: boolean;
  constraints: Record<string, unknown>;
  scope: Record<string, unknown>;
  risk_level: RiskLevel;
  plan: unknown[];
  next_run_at?: string | null;
  last_iteration_at?: string | null;
  iteration_count: number;
  stuck_score: number;
  agent_id?: string | null;
  execution_mode?: boolean;
  completion_criteria?: string | null;
  priority?: string;
  cursor_agent_id?: string | null;
  cursor_session_url?: string | null;
  created_at: string;
  updated_at: string;
};

export type GoalCriterionRow = {
  id: string;
  goal_id: string;
  tenant_id: string;
  criterion_key: string;
  description: string;
  required: boolean;
  verification_type: string;
  verification_config: Record<string, unknown>;
  evidence_required?: string | null;
  status: CriterionStatus;
  last_verified_at?: string | null;
  sort_order: number;
};

export type GoalPlanStepRow = {
  id: string;
  goal_id: string;
  tenant_id: string;
  title: string;
  description?: string | null;
  action_type: string;
  status: string;
  priority: number;
  metadata: Record<string, unknown>;
  sort_order: number;
  sub_project_key?: string | null;
  sub_project_label?: string | null;
  parallel_track?: boolean;
  cursor_agent_id?: string | null;
  cursor_session_url?: string | null;
};

type SupabaseLike = { from: (t: string) => any };

export function hashInput(input: unknown): string {
  const s = JSON.stringify(input);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(16).padStart(8, "0");
}

export function slugifyKey(text: string, index = 0): string {
  const base = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
  return base || `criterion_${index}`;
}

export function buildContextPackage(state: {
  goal: AutonomousGoalRow;
  criteria: GoalCriterionRow[];
  planSteps: GoalPlanStepRow[];
  recentActions: Array<{ action_type: string; tool_name?: string | null; status: string; input_hash?: string | null }>;
  blockers: Array<{ title: string; status: string; requires_human?: boolean }>;
}): Record<string, unknown> {
  return {
    goal_id: state.goal.id,
    objective: state.goal.objective || state.goal.title,
    description: state.goal.description,
    engine_status: state.goal.engine_status,
    constraints: state.goal.constraints,
    scope: state.goal.scope,
    risk_level: state.goal.risk_level,
    iteration_count: state.goal.iteration_count,
    success_criteria: state.criteria.map((c) => ({
      key: c.criterion_key,
      description: c.description,
      status: c.status,
      required: c.required,
    })),
    plan_steps: state.planSteps.map((s) => ({
      id: s.id,
      title: s.title,
      action_type: s.action_type,
      status: s.status,
    })),
    open_blockers: state.blockers.filter((b) => b.status === "open"),
    recent_actions: state.recentActions.slice(0, 8),
  };
}

export function checkCompletionGate(criteria: GoalCriterionRow[]): {
  complete: boolean;
  pending: GoalCriterionRow[];
  failed: GoalCriterionRow[];
} {
  const required = criteria.filter((c) => c.required);
  const pending = required.filter((c) => c.status !== "PASS");
  const failed = required.filter((c) => c.status === "FAIL");
  return { complete: pending.length === 0 && required.length > 0, pending, failed };
}

export function detectStuckPatterns(
  recentActions: Array<{ input_hash?: string | null; status: string; error?: string | null }>,
  previousStuckScore: number,
): { stuck: boolean; score: number; reason?: string } {
  let score = previousStuckScore;
  if (recentActions.length < 3) return { stuck: false, score };

  const last5 = recentActions.slice(0, 5);
  const hashes = last5.map((a) => a.input_hash).filter(Boolean);
  if (hashes.length >= 3 && new Set(hashes).size === 1) {
    score += 2;
  }
  const errors = last5.filter((a) => a.status === "failed").map((a) => a.error).filter(Boolean);
  if (errors.length >= 3 && new Set(errors).size === 1) {
    score += 2;
  }
  const stuck = score >= 4;
  return {
    stuck,
    score,
    reason: stuck ? "repeated_action_or_error" : undefined,
  };
}

export async function seedSuccessCriteria(
  supabase: SupabaseLike,
  args: {
    tenantId: string;
    goalId: string;
    title: string;
    completionCriteria?: string | null;
    successCriteria?: SuccessCriterionInput[];
  },
): Promise<GoalCriterionRow[]> {
  const criteriaRows: GoalCriterionRow[] = [];
  let criteria: SuccessCriterionInput[] = args.successCriteria?.length
    ? args.successCriteria
    : [];

  if (!criteria.length && args.completionCriteria?.trim()) {
    criteria = args.completionCriteria
      .split(/\n+/)
      .map((line) => line.replace(/^[-•*]\s*/, "").trim())
      .filter(Boolean)
      .map((description) => ({ description, required: true }));
  }
  if (!criteria.length) {
    criteria = [{ description: `היעד "${args.title}" הושלם במלואו עם הוכחה`, required: true }];
  }

  for (const [i, c] of criteria.entries()) {
    const key = c.key || slugifyKey(c.description, i);
    const { data: row, error: cErr } = await supabase.from("goal_success_criteria").insert({
      tenant_id: args.tenantId,
      goal_id: args.goalId,
      criterion_key: key,
      description: c.description,
      required: c.required ?? true,
      verification_type: c.verification_type ?? "manual",
      verification_config: c.verification_config ?? {},
      evidence_required: c.evidence_required ?? "הוכחה ברורה שהקריטריון מתקיים",
      status: "NOT_TESTED",
      sort_order: i,
    }).select("*").single();
    if (cErr) throw cErr;
    criteriaRows.push(row);
  }
  return criteriaRows;
}

/** @deprecated Prefer createUnifiedGoal({ autonomous: true }) from goal-execution.ts */
export async function createAutonomousGoal(
  supabase: SupabaseLike,
  args: {
    tenantId: string;
    title: string;
    objective?: string;
    description?: string;
    constraints?: Record<string, unknown>;
    scope?: Record<string, unknown>;
    riskLevel?: RiskLevel;
    successCriteria?: SuccessCriterionInput[];
    agentId?: string | null;
    actorUserId?: string | null;
    priority?: string;
    completionCriteria?: string;
  },
): Promise<{ goal: AutonomousGoalRow; criteria: GoalCriterionRow[] }> {
  const { goal, criteria } = await createUnifiedGoal(supabase, {
    tenantId: args.tenantId,
    title: args.title,
    objective: args.objective,
    description: args.description,
    constraints: args.constraints,
    scope: args.scope,
    riskLevel: args.riskLevel,
    successCriteria: args.successCriteria,
    completionCriteria: args.completionCriteria,
    agentId: args.agentId,
    actorUserId: args.actorUserId,
    priority: args.priority,
    autonomous: true,
  });
  return { goal: goal as AutonomousGoalRow, criteria: (criteria || []) as GoalCriterionRow[] };
}

export async function loadGoalState(
  supabase: SupabaseLike,
  tenantId: string,
  goalId: string,
): Promise<{
  goal: AutonomousGoalRow;
  criteria: GoalCriterionRow[];
  planSteps: GoalPlanStepRow[];
  recentActions: any[];
  blockers: any[];
} | null> {
  const { data: goal, error } = await supabase.from("goals").select("*")
    .eq("id", goalId).eq("tenant_id", tenantId).eq("autonomous_mode", true).maybeSingle();
  if (error) throw error;
  if (!goal) return null;

  const [{ data: criteria }, { data: planSteps }, { data: recentActions }, { data: blockers }] = await Promise.all([
    supabase.from("goal_success_criteria").select("*").eq("goal_id", goalId).order("sort_order"),
    supabase.from("goal_plan_steps").select("*").eq("goal_id", goalId).order("sort_order"),
    supabase.from("goal_actions").select("id, action_type, tool_name, status, input_hash, error, started_at")
      .eq("goal_id", goalId).order("started_at", { ascending: false }).limit(12),
    supabase.from("goal_blockers").select("*").eq("goal_id", goalId).order("created_at", { ascending: false }),
  ]);

  return {
    goal,
    criteria: criteria || [],
    planSteps: planSteps || [],
    recentActions: recentActions || [],
    blockers: blockers || [],
  };
}

async function recordModelEvent(
  supabase: SupabaseLike,
  args: {
    tenantId: string;
    goalId: string;
    iterationId: string;
    profile: ModelProfile;
    result: Awaited<ReturnType<typeof modelRouterJSON>>;
  },
): Promise<void> {
  await supabase.from("goal_model_events").insert({
    tenant_id: args.tenantId,
    goal_id: args.goalId,
    iteration_id: args.iterationId,
    profile: args.profile,
    provider: args.result.provider,
    model: args.result.model,
    tokens_in: args.result.tokensIn,
    tokens_out: args.result.tokensOut,
    cost_usd: args.result.costUsd,
    latency_ms: args.result.latencyMs,
    error_class: args.result.errorClass ?? null,
    failover_reason: args.result.failoverReason ?? null,
  });
}

async function planGoalIfNeeded(
  supabase: SupabaseLike,
  state: Awaited<ReturnType<typeof loadGoalState>>,
  iterationId: string,
): Promise<{ awaiting_brain?: boolean; dispatched?: boolean; fallback?: boolean }> {
  if (!state) return {};
  const pendingSteps = state.planSteps.filter((s) => s.status === "pending" || s.status === "in_progress");
  if (pendingSteps.length > 0) return {};

  const {
    getInFlightBrainRequest,
    queueBrainRequest,
    goalBrainApiFallbackEnabled,
  } = await import("./goal-cursor-brain.ts");
  const { buildPlanBrainPrompt } = await import("./goal-brain-apply.ts");

  const inflight = await getInFlightBrainRequest(supabase, state.goal.id, "plan");
  if (inflight) return { awaiting_brain: true };

  const ctx = buildContextPackage(state);
  const prompt = buildPlanBrainPrompt(ctx);
  const queued = await queueBrainRequest(supabase, {
    tenantId: state.goal.tenant_id,
    goalId: state.goal.id,
    requestType: "plan",
    prompt,
    iterationId,
  });

  if (queued.dispatched || queued.awaiting) {
    return { awaiting_brain: true, dispatched: queued.dispatched };
  }

  if (!goalBrainApiFallbackEnabled()) {
    throw new Error(queued.reason || "cursor_direct_brain_unavailable");
  }

  const result = await modelRouterJSON<{ plan_steps?: Array<{
    title: string;
    description?: string;
    action_type?: string;
    priority?: number;
    parallel_track?: boolean;
    sub_project_key?: string;
    sub_project_label?: string;
  }> }>("DEEP_REASON", prompt);
  await recordModelEvent(supabase, {
    tenantId: state.goal.tenant_id,
    goalId: state.goal.id,
    iterationId,
    profile: "DEEP_REASON",
    result,
  });
  if (!result.ok || !result.data?.plan_steps?.length) {
    throw new Error(result.failoverReason || "planning_failed");
  }

  const steps = result.data.plan_steps.slice(0, 8);
  for (const [i, step] of steps.entries()) {
    const actionType = ["model", "cursor", "verify", "observe", "tool"].includes(step.action_type || "")
      ? step.action_type!
      : "model";
    const parallelTrack = !!(step.parallel_track && actionType === "cursor" && step.sub_project_key);
    await supabase.from("goal_plan_steps").insert({
      tenant_id: state.goal.tenant_id,
      goal_id: state.goal.id,
      title: step.title,
      description: step.description ?? null,
      action_type: actionType,
      status: "pending",
      priority: step.priority ?? 5,
      sort_order: i,
      parallel_track: parallelTrack,
      sub_project_key: parallelTrack ? step.sub_project_key : null,
      sub_project_label: parallelTrack ? (step.sub_project_label || step.title) : null,
      metadata: parallelTrack ? { parallel_track: true } : {},
    });
  }
  await supabase.from("goals").update({
    plan: steps,
    engine_status: "EXECUTING",
    updated_at: new Date().toISOString(),
  }).eq("id", state.goal.id);
  return { fallback: true };
}

async function monitorInProgressCursorSteps(
  supabase: SupabaseLike,
  state: NonNullable<Awaited<ReturnType<typeof loadGoalState>>>,
): Promise<number> {
  const { selectInProgressCursorTracks } = await import("./goal-parallel-orchestration.ts");
  const tracks = selectInProgressCursorTracks(state.planSteps);
  let completed = 0;
  for (const step of tracks) {
    const devTaskId = (step.metadata as Record<string, unknown>)?.dev_task_id as string | undefined;
    if (!devTaskId) continue;
    const { data: dt } = await supabase.from("dev_tasks")
      .select("status, pr_url").eq("id", devTaskId).maybeSingle();
    if (dt && ["pr_opened", "ready_for_review", "done"].includes(dt.status)) {
      await supabase.from("goal_plan_steps").update({
        status: "done",
        completed_at: new Date().toISOString(),
        metadata: { ...step.metadata, pr_url: dt.pr_url, completed_via: "dev_task_status" },
      }).eq("id", step.id);
      completed++;
    }
  }
  return completed;
}

async function executePlanStep(
  supabase: SupabaseLike,
  state: NonNullable<Awaited<ReturnType<typeof loadGoalState>>>,
  step: GoalPlanStepRow,
  iterationId: string,
): Promise<{ done: boolean; blocked?: boolean; blockerTitle?: string; monitoring?: boolean; dispatched?: boolean }> {
  const input = { step_id: step.id, title: step.title, action_type: step.action_type };
  const inputHash = hashInput(input);

  const { data: action } = await supabase.from("goal_actions").insert({
    tenant_id: state.goal.tenant_id,
    goal_id: state.goal.id,
    iteration_id: iterationId,
    step_id: step.id,
    action_type: step.action_type,
    input_hash: inputHash,
    input,
    status: "running",
  }).select("*").single();

  await supabase.from("goal_plan_steps").update({
    status: "in_progress",
    started_at: new Date().toISOString(),
  }).eq("id", step.id);

  try {
    if (step.action_type === "cursor") {
      const parallelTrack = step.parallel_track || !!(step.metadata as Record<string, unknown>)?.parallel_track;
      if (step.status === "in_progress" && step.cursor_agent_id) {
        return { done: false, monitoring: true };
      }

      const { dispatchToGoalCursor } = await import("./goal-cursor-dispatch.ts");
      const { OPEN_DEV_STATUSES } = await import("./dev-tasks.ts");
      const acceptance = state.criteria.map((c) => c.description).join("\n");

      const cursorResult = await dispatchToGoalCursor(supabase, {
        tenantId: state.goal.tenant_id,
        goalId: state.goal.id,
        goalTitle: state.goal.title,
        objective: state.goal.objective || state.goal.title,
        stepTitle: step.title,
        stepDescription: step.description || undefined,
        acceptanceCriteria: acceptance,
        constraints: state.goal.constraints,
        planStepId: step.id,
        subProjectKey: step.sub_project_key || undefined,
        subProjectLabel: step.sub_project_label || step.title,
        useStepSticky: parallelTrack,
      });

      // Parallel tracks: one dev_task per sub-project. Single-track: one per goal.
      let devTaskId = (step.metadata as Record<string, unknown>)?.dev_task_id as string | undefined;
      const { createDevTask, attachDevTaskSession } = await import("./dev-tasks.ts");

      if (!devTaskId && !parallelTrack) {
        const { data: existingDev } = await supabase.from("dev_tasks").select("id, cursor_session_id")
          .eq("goal_id", state.goal.id).eq("tenant_id", state.goal.tenant_id)
          .in("status", OPEN_DEV_STATUSES).order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (existingDev?.id) devTaskId = existingDev.id;
      }

      if (devTaskId) {
        const { data: dt } = await supabase.from("dev_tasks").select("cursor_session_id")
          .eq("id", devTaskId).maybeSingle();
        if (!dt?.cursor_session_id) {
          await attachDevTaskSession(supabase, {
            tenantId: state.goal.tenant_id,
            taskId: devTaskId,
            cursorSessionId: cursorResult.cursorAgentId,
            cursorSessionUrl: cursorResult.sessionUrl,
          });
        }
      } else {
        const devTask = await createDevTask(supabase, {
          tenantId: state.goal.tenant_id,
          brief: {
            title: parallelTrack ? `${state.goal.title} · ${step.sub_project_label || step.title}` : state.goal.title,
            problem: step.description || state.goal.objective || state.goal.title,
            acceptance_criteria: acceptance,
            requested_by: "carmen_autonomous_goal",
            environment: "staging",
            base_branch: "develop",
            scope: parallelTrack ? `sub_project:${step.sub_project_key}` : undefined,
          },
          goalId: state.goal.id,
          assignedAgent: "cursor",
          priority: "normal",
        });
        devTaskId = devTask.id;
        await attachDevTaskSession(supabase, {
          tenantId: state.goal.tenant_id,
          taskId: devTask.id,
          cursorSessionId: cursorResult.cursorAgentId,
          cursorSessionUrl: cursorResult.sessionUrl,
        });
      }

      await supabase.from("goal_actions").update({
        status: "completed",
        result: {
          dev_task_id: devTaskId,
          cursor_agent_id: cursorResult.cursorAgentId,
          cursor_session_url: cursorResult.sessionUrl,
          reused_session: cursorResult.reused,
        },
        completed_at: new Date().toISOString(),
      }).eq("id", action.id);
      const stepStatus = parallelTrack ? "in_progress" : "done";
      await supabase.from("goal_plan_steps").update({
        status: stepStatus,
        completed_at: parallelTrack ? null : new Date().toISOString(),
        metadata: {
          dev_task_id: devTaskId,
          cursor_agent_id: cursorResult.cursorAgentId,
          parallel_track: parallelTrack,
        },
      }).eq("id", step.id);
      return { done: !parallelTrack, dispatched: parallelTrack };
    }

    if (step.action_type === "verify") {
      await supabase.from("goals").update({ engine_status: "VERIFYING" }).eq("id", state.goal.id);
      await supabase.from("goal_actions").update({
        status: "completed",
        result: { phase: "verify_requested" },
        completed_at: new Date().toISOString(),
      }).eq("id", action.id);
      await supabase.from("goal_plan_steps").update({
        status: "done",
        completed_at: new Date().toISOString(),
      }).eq("id", step.id);
      return { done: true };
    }

    // model / observe — orchestration brain via Cursor Direct (not Model API)
    const ctx = buildContextPackage(state);
    const {
      getInFlightBrainRequest,
      queueBrainRequest,
      goalBrainApiFallbackEnabled,
    } = await import("./goal-cursor-brain.ts");
    const { buildStepExecuteBrainPrompt } = await import("./goal-brain-apply.ts");

    const inflight = await getInFlightBrainRequest(supabase, state.goal.id, "step_execute");
    if (inflight && inflight.step_id === step.id) {
      return { done: false, monitoring: true };
    }

    const prompt = buildStepExecuteBrainPrompt(step.title, step.description || "", ctx);
    const queued = await queueBrainRequest(supabase, {
      tenantId: state.goal.tenant_id,
      goalId: state.goal.id,
      requestType: "step_execute",
      prompt,
      iterationId,
      stepId: step.id,
      actionId: action.id,
    });

    if (queued.dispatched || queued.awaiting) {
      return { done: false, monitoring: true };
    }

    if (!goalBrainApiFallbackEnabled()) {
      throw new Error(queued.reason || "cursor_direct_brain_unavailable");
    }

    const result = await modelRouterJSON<{
      summary?: string;
      evidence?: Array<{ criterion_key?: string; type: string; content: Record<string, unknown> }>;
      criterion_updates?: Array<{ key: string; status: CriterionStatus; reason?: string }>;
    }>("FAST_REASON", prompt);
    await recordModelEvent(supabase, {
      tenantId: state.goal.tenant_id,
      goalId: state.goal.id,
      iterationId,
      profile: "FAST_REASON",
      result,
    });
    if (!result.ok) throw new Error(result.failoverReason || "model_step_failed");

    for (const ev of result.data?.evidence || []) {
      const criterion = state.criteria.find((c) => c.criterion_key === ev.criterion_key);
      await supabase.from("goal_evidence").insert({
        tenant_id: state.goal.tenant_id,
        goal_id: state.goal.id,
        criterion_id: criterion?.id ?? null,
        evidence_type: ev.type,
        content: ev.content,
        source_action_id: action.id,
      });
    }
    for (const upd of result.data?.criterion_updates || []) {
      const criterion = state.criteria.find((c) => c.criterion_key === upd.key);
      if (!criterion) continue;
      if (!["PASS", "FAIL", "UNKNOWN", "NOT_TESTED"].includes(upd.status)) continue;
      await supabase.from("goal_success_criteria").update({
        status: upd.status,
        last_verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", criterion.id);
    }
    await supabase.from("goal_actions").update({
      status: "completed",
      result: result.data,
      completed_at: new Date().toISOString(),
    }).eq("id", action.id);
    await supabase.from("goal_plan_steps").update({
      status: "done",
      completed_at: new Date().toISOString(),
    }).eq("id", step.id);
    return { done: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabase.from("goal_actions").update({
      status: "failed",
      error: msg,
      completed_at: new Date().toISOString(),
    }).eq("id", action.id);
    await supabase.from("goal_plan_steps").update({ status: "failed" }).eq("id", step.id);
    return { done: false };
  }
}

export async function acquireGoalLock(
  supabase: SupabaseLike,
  goalId: string,
  holder: string,
  ttlSeconds = 120,
): Promise<boolean> {
  const until = new Date(Date.now() + ttlSeconds * 1000).toISOString();
  const now = new Date().toISOString();
  const { data } = await supabase.from("goals").select("id, lock_until, lock_holder")
    .eq("id", goalId).maybeSingle();
  if (!data) return false;
  if (data.lock_until && data.lock_until > now && data.lock_holder !== holder) return false;
  const { error } = await supabase.from("goals").update({
    lock_until: until,
    lock_holder: holder,
  }).eq("id", goalId);
  return !error;
}

export async function releaseGoalLock(supabase: SupabaseLike, goalId: string, holder: string): Promise<void> {
  await supabase.from("goals").update({
    lock_until: null,
    lock_holder: null,
  }).eq("id", goalId).eq("lock_holder", holder);
}

export async function runGoalIteration(
  supabase: SupabaseLike,
  tenantId: string,
  goalId: string,
  lockHolder: string,
): Promise<{ status: EngineStatus; summary: string }> {
  const locked = await acquireGoalLock(supabase, goalId, lockHolder);
  if (!locked) return { status: "EXECUTING", summary: "lock_busy" };

  let iterationId = "";
  try {
    const state = await loadGoalState(supabase, tenantId, goalId);
    if (!state) return { status: "BLOCKED", summary: "goal_not_found" };

    const { goal } = state;
    if (goal.engine_status === "COMPLETED") {
      return { status: "COMPLETED", summary: "already_completed" };
    }

    const { getInFlightBrainRequest } = await import("./goal-cursor-brain.ts");
    const brainInflight = await getInFlightBrainRequest(supabase, goalId);
    if (brainInflight || goal.engine_status === "AWAITING_BRAIN") {
      return { status: "AWAITING_BRAIN", summary: `awaiting_brain:${brainInflight?.request_type || "unknown"}` };
    }

    const iterationNumber = (goal.iteration_count || 0) + 1;
    const { data: iteration, error: iterErr } = await supabase.from("goal_loop_iterations").insert({
      tenant_id: tenantId,
      goal_id: goalId,
      iteration_number: iterationNumber,
      phase: goal.engine_status,
      status: "running",
      context_snapshot: buildContextPackage(state),
    }).select("id").single();
    if (iterErr) throw iterErr;
    iterationId = iteration.id;

    // Completion Gate
    const gate = checkCompletionGate(state.criteria);
    if (gate.complete) {
      await supabase.from("goals").update({
        engine_status: "COMPLETED",
        status: "completed",
        progress_percent: 100,
        next_run_at: null,
        iteration_count: iterationNumber,
        last_iteration_at: new Date().toISOString(),
      }).eq("id", goalId);
      await supabase.from("goal_loop_iterations").update({
        status: "completed",
        summary: "completion_gate_passed",
        completed_at: new Date().toISOString(),
      }).eq("id", iterationId);
      await logGoalEvent(supabase, {
        goalId, tenantId, eventType: "autonomous_goal_completed",
        detail: { iteration: iterationNumber },
      });
      const { notifyDavidStagingReady } = await import("./goal-parallel-orchestration.ts");
      await notifyDavidStagingReady(supabase, {
        tenantId,
        goalId,
        goalTitle: goal.title,
        subProjects: state.planSteps
          .filter((s) => s.sub_project_key)
          .map((s) => ({
            label: s.sub_project_label || s.title,
            sessionUrl: s.cursor_session_url,
            status: s.status,
          })),
      });
      return { status: "COMPLETED", summary: "completion_gate_passed" };
    }

    // Stuck detection
    const stuck = detectStuckPatterns(state.recentActions, goal.stuck_score);
    if (stuck.stuck) {
      await supabase.from("goals").update({
        engine_status: "REPLANNING",
        stuck_score: stuck.score,
        plan: [],
      }).eq("id", goalId);
      await supabase.from("goal_plan_steps").update({ status: "skipped" })
        .eq("goal_id", goalId).in("status", ["pending", "in_progress"]);
      await supabase.from("goal_blockers").insert({
        tenant_id: tenantId,
        goal_id: goalId,
        title: "לולאה תקועה — נדרשת תכנון מחדש",
        description: stuck.reason,
        blocker_type: "stuck_loop",
        requires_human: false,
      });
    }

    // Planning phase — Cursor Direct brain (async callback applies plan)
    if (goal.engine_status === "PLANNING" || goal.engine_status === "REPLANNING") {
      const planOutcome = await planGoalIfNeeded(
        supabase,
        await loadGoalState(supabase, tenantId, goalId),
        iterationId,
      );
      if (planOutcome.awaiting_brain) {
        await supabase.from("goal_loop_iterations").update({
          status: "completed",
          summary: planOutcome.dispatched ? "brain_plan_dispatched" : "brain_plan_awaiting",
          completed_at: new Date().toISOString(),
        }).eq("id", iterationId);
        return { status: "AWAITING_BRAIN", summary: "brain_plan_dispatched" };
      }
    }

    const freshState = await loadGoalState(supabase, tenantId, goalId);
    if (!freshState) throw new Error("state_lost");

    const {
      selectParallelDispatchBatch,
      selectNextSequentialStep,
      selectInProgressCursorTracks,
    } = await import("./goal-parallel-orchestration.ts");

    const monitored = await monitorInProgressCursorSteps(supabase, freshState);
    let summary = monitored > 0 ? `tracks_completed:${monitored}` : "noop";

    const parallelBatch = selectParallelDispatchBatch(freshState.planSteps);
    if (parallelBatch.length >= 2) {
      const results = await Promise.all(
        parallelBatch.map((s) => executePlanStep(supabase, freshState, s, iterationId)),
      );
      const ok = results.filter((r) => r.dispatched || r.done).length;
      summary = `parallel_dispatch:${ok}/${parallelBatch.length}`;
    } else {
      const inProgress = selectInProgressCursorTracks(freshState.planSteps);
      if (inProgress.length > 0 && summary === "noop") {
        summary = `monitoring:${inProgress.length}_tracks`;
      } else {
        const nextStep = selectNextSequentialStep(freshState.planSteps)
          || freshState.planSteps
            .filter((s) => s.status === "pending")
            .sort((a, b) => a.priority - b.priority || a.sort_order - b.sort_order)[0];
        if (nextStep) {
          const exec = await executePlanStep(supabase, freshState, nextStep, iterationId);
          summary = exec.dispatched
            ? `dispatched:${nextStep.title}`
            : exec.monitoring
              ? `monitoring:${nextStep.title}`
              : exec.done
                ? `step_done:${nextStep.title}`
                : `step_failed:${nextStep.title}`;
        } else if (freshState.goal.engine_status === "VERIFYING") {
          summary = "awaiting_verification_evidence";
        } else if (inProgress.length === 0) {
          await planGoalIfNeeded(supabase, freshState, iterationId);
          summary = "replanned";
        }
      }
    }

    const afterState = await loadGoalState(supabase, tenantId, goalId);
    const finalGate = checkCompletionGate(afterState?.criteria || []);
    let awaitingBrain = false;

    if (!finalGate.complete) {
      const { runPostIterationEfficiencyReview } = await import("./goal-efficiency-review.ts");
      const eff = await runPostIterationEfficiencyReview(supabase, {
        tenantId,
        goalId,
        goalTitle: afterState?.goal.title || goal.title,
        objective: afterState?.goal.objective || goal.objective,
        iterationId,
        iterationNumber,
        stuckScore: stuck.score,
        constraints: afterState?.goal.constraints || goal.constraints,
      });
      if (eff.awaiting_brain) {
        awaitingBrain = true;
        summary += ";efficiency_brain_pending";
      } else if (eff.review && !eff.review.efficient) {
        summary += `;efficiency_score:${eff.review.score}`;
        if (eff.cursor_dispatched) summary += ";cursor_optimize_sent";
      }
    }

    const brainInflightFinal = await getInFlightBrainRequest(supabase, goalId);
    if (brainInflightFinal) awaitingBrain = true;

    const nextStatus: EngineStatus = finalGate.complete
      ? "COMPLETED"
      : awaitingBrain
        ? "AWAITING_BRAIN"
        : (afterState?.goal.engine_status === "VERIFYING" ? "VERIFYING" : "EXECUTING");

    await supabase.from("goals").update({
      engine_status: nextStatus,
      status: finalGate.complete ? "completed" : "in_progress",
      progress_percent: finalGate.complete ? 100 : Math.min(95, iterationNumber * 5),
      iteration_count: iterationNumber,
      last_iteration_at: new Date().toISOString(),
      next_run_at: finalGate.complete ? null : new Date(Date.now() + 60_000).toISOString(),
      stuck_score: stuck.score,
    }).eq("id", goalId);

    await supabase.from("goal_loop_iterations").update({
      status: "completed",
      summary,
      completed_at: new Date().toISOString(),
    }).eq("id", iterationId);

    if (finalGate.complete) {
      const { notifyDavidStagingReady } = await import("./goal-parallel-orchestration.ts");
      await notifyDavidStagingReady(supabase, {
        tenantId,
        goalId,
        goalTitle: afterState?.goal.title || goal.title,
        subProjects: (afterState?.planSteps || [])
          .filter((s) => s.sub_project_key)
          .map((s) => ({
            label: s.sub_project_label || s.title,
            sessionUrl: s.cursor_session_url,
            status: s.status,
          })),
      });
    }

    return { status: finalGate.complete ? "COMPLETED" : (awaitingBrain ? "AWAITING_BRAIN" : nextStatus), summary };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (iterationId) {
      await supabase.from("goal_loop_iterations").update({
        status: "failed",
        error_message: msg,
        completed_at: new Date().toISOString(),
      }).eq("id", iterationId);
    }
    await supabase.from("goals").update({
      engine_status: "BLOCKED",
      next_run_at: new Date(Date.now() + 5 * 60_000).toISOString(),
    }).eq("id", goalId);
    return { status: "BLOCKED", summary: msg };
  } finally {
    await releaseGoalLock(supabase, goalId, lockHolder);
  }
}

export async function getAutonomousGoalStatus(
  supabase: SupabaseLike,
  tenantId: string,
  goalId: string,
) {
  const state = await loadGoalState(supabase, tenantId, goalId);
  if (!state) return null;
  const gate = checkCompletionGate(state.criteria);
  const { data: iterations } = await supabase.from("goal_loop_iterations")
    .select("id, iteration_number, phase, status, summary, started_at, completed_at")
    .eq("goal_id", goalId).order("iteration_number", { ascending: false }).limit(5);
  const { data: evidence } = await supabase.from("goal_evidence")
    .select("id, criterion_id, evidence_type, verified_at")
    .eq("goal_id", goalId).order("verified_at", { ascending: false }).limit(10);
  const parallelTracks = state.planSteps
    .filter((s) => s.parallel_track || s.sub_project_key)
    .map((s) => ({
      id: s.id,
      key: s.sub_project_key,
      label: s.sub_project_label || s.title,
      status: s.status,
      cursor_agent_id: s.cursor_agent_id,
      cursor_session_url: s.cursor_session_url,
    }));

  const { data: brainSession } = await supabase.from("goal_orchestrator_brain")
    .select("cursor_session_id, cursor_session_url, session_source, updated_at")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  const { data: brainRequests } = await supabase.from("goal_brain_requests")
    .select("id, request_type, status, created_at, completed_at")
    .eq("goal_id", goalId)
    .order("created_at", { ascending: false })
    .limit(5);

  return {
    goal: state.goal,
    criteria: state.criteria,
    plan_steps: state.planSteps,
    parallel_tracks: parallelTracks,
    blockers: state.blockers.filter((b) => b.status === "open"),
    completion_gate: gate,
    recent_iterations: iterations || [],
    recent_evidence: evidence || [],
    orchestrator_brain: brainSession || null,
    brain_requests: brainRequests || [],
  };
}

export async function listDueAutonomousGoals(
  supabase: SupabaseLike,
  limit = 10,
): Promise<AutonomousGoalRow[]> {
  const now = new Date().toISOString();
  const { data, error } = await supabase.from("goals").select("*")
    .eq("autonomous_mode", true)
    .neq("engine_status", "COMPLETED")
    .or(`next_run_at.is.null,next_run_at.lte.${now}`)
    .order("next_run_at", { ascending: true, nullsFirst: true })
    .limit(limit);
  if (error) throw error;
  return (data || []).filter((g: AutonomousGoalRow) => {
    if (g.engine_status === "COMPLETED") return false;
    if (g.engine_status === "BLOCKED" && g.next_run_at && g.next_run_at > now) return false;
    return true;
  });
}
