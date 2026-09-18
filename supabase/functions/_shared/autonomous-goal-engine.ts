/**
 * Carmen Autonomous Goal Engine — Phase 1
 * Goal Contract, persisted loop, Completion Gate, stuck detection.
 */

import { createUnifiedGoal, logGoalEvent } from "./goal-execution.ts";
import { modelRouterJSON, type ModelProfile } from "./model-router.ts";

export const ENGINE_STATUSES = [
  "PLANNING", "EXECUTING", "VERIFYING", "REPLANNING", "BLOCKED", "COMPLETED",
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
): Promise<void> {
  if (!state) return;
  const pendingSteps = state.planSteps.filter((s) => s.status === "pending" || s.status === "in_progress");
  if (pendingSteps.length > 0) return;

  const ctx = buildContextPackage(state);
  const prompt = `You are Carmen's autonomous goal planner. Given this Goal Contract context, output JSON:
{
  "plan_steps": [
    { "title": "...", "description": "...", "action_type": "model|cursor|verify|observe", "priority": 1-10 }
  ],
  "notes": "brief planning notes"
}
Rules:
- Technical/code changes MUST use action_type "cursor" (never pretend code was written in text).
- Keep 2-6 steps max for this iteration.
- action_type "verify" for explicit verification steps.
Context:
${JSON.stringify(ctx, null, 2)}`;

  const result = await modelRouterJSON<{ plan_steps?: Array<{ title: string; description?: string; action_type?: string; priority?: number }> }>(
    "DEEP_REASON",
    prompt,
  );
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

  const steps = result.data.plan_steps.slice(0, 6);
  for (const [i, step] of steps.entries()) {
    const actionType = ["model", "cursor", "verify", "observe", "tool"].includes(step.action_type || "")
      ? step.action_type!
      : "model";
    await supabase.from("goal_plan_steps").insert({
      tenant_id: state.goal.tenant_id,
      goal_id: state.goal.id,
      title: step.title,
      description: step.description ?? null,
      action_type: actionType,
      status: "pending",
      priority: step.priority ?? 5,
      sort_order: i,
      metadata: {},
    });
  }

  await supabase.from("goals").update({
    plan: steps,
    engine_status: "EXECUTING",
    updated_at: new Date().toISOString(),
  }).eq("id", state.goal.id);
}

async function executePlanStep(
  supabase: SupabaseLike,
  state: NonNullable<Awaited<ReturnType<typeof loadGoalState>>>,
  step: GoalPlanStepRow,
  iterationId: string,
): Promise<{ done: boolean; blocked?: boolean; blockerTitle?: string }> {
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
      });

      // One dev_task tracker per goal — reuse open row, link to sticky session.
      let devTaskId: string | null = null;
      const { data: existingDev } = await supabase.from("dev_tasks").select("id, cursor_session_id")
        .eq("goal_id", state.goal.id).eq("tenant_id", state.goal.tenant_id)
        .in("status", OPEN_DEV_STATUSES).order("created_at", { ascending: false }).limit(1).maybeSingle();

      if (existingDev?.id) {
        devTaskId = existingDev.id;
        if (!existingDev.cursor_session_id) {
          const { attachDevTaskSession } = await import("./dev-tasks.ts");
          await attachDevTaskSession(supabase, {
            tenantId: state.goal.tenant_id,
            taskId: existingDev.id,
            cursorSessionId: cursorResult.cursorAgentId,
            cursorSessionUrl: cursorResult.sessionUrl,
          });
        }
      } else {
        const { createDevTask, attachDevTaskSession } = await import("./dev-tasks.ts");
        const devTask = await createDevTask(supabase, {
          tenantId: state.goal.tenant_id,
          brief: {
            title: state.goal.title,
            problem: state.goal.objective || state.goal.title,
            acceptance_criteria: acceptance,
            requested_by: "carmen_autonomous_goal",
            environment: "staging",
            base_branch: "develop",
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
      await supabase.from("goal_plan_steps").update({
        status: "done",
        completed_at: new Date().toISOString(),
        metadata: { dev_task_id: devTaskId, cursor_agent_id: cursorResult.cursorAgentId },
      }).eq("id", step.id);
      return { done: true };
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

    // model / observe — fast reasoning
    const ctx = buildContextPackage(state);
    const prompt = `Execute this plan step for an autonomous goal. Reply JSON:
{ "summary": "...", "evidence": [{ "criterion_key": "optional", "type": "observation", "content": {} }], "criterion_updates": [{ "key": "...", "status": "PASS|FAIL|UNKNOWN|NOT_TESTED", "reason": "..." }] }
Step: ${step.title}
${step.description || ""}
Context: ${JSON.stringify(ctx)}`;

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

    // Planning phase
    if (goal.engine_status === "PLANNING" || goal.engine_status === "REPLANNING") {
      await planGoalIfNeeded(supabase, await loadGoalState(supabase, tenantId, goalId), iterationId);
    }

    const freshState = await loadGoalState(supabase, tenantId, goalId);
    if (!freshState) throw new Error("state_lost");

    const nextStep = freshState.planSteps
      .filter((s) => s.status === "pending")
      .sort((a, b) => a.priority - b.priority || a.sort_order - b.sort_order)[0];

    let summary = "noop";
    if (nextStep) {
      const exec = await executePlanStep(supabase, freshState, nextStep, iterationId);
      summary = exec.done ? `step_done:${nextStep.title}` : `step_failed:${nextStep.title}`;
    } else if (freshState.goal.engine_status === "VERIFYING") {
      summary = "awaiting_verification_evidence";
    } else {
      await planGoalIfNeeded(supabase, freshState, iterationId);
      summary = "replanned";
    }

    const afterState = await loadGoalState(supabase, tenantId, goalId);
    const finalGate = checkCompletionGate(afterState?.criteria || []);
    const nextStatus: EngineStatus = finalGate.complete
      ? "COMPLETED"
      : (afterState?.goal.engine_status === "VERIFYING" ? "VERIFYING" : "EXECUTING");

    await supabase.from("goals").update({
      engine_status: finalGate.complete ? "COMPLETED" : nextStatus,
      status: finalGate.complete ? "completed" : "in_progress",
      progress_percent: finalGate.complete ? 100 : Math.min(95, iterationNumber * 5),
      iteration_count: iterationNumber,
      last_iteration_at: new Date().toISOString(),
      next_run_at: finalGate.complete ? null : new Date(Date.now() + 60_000).toISOString(),
      stuck_score: stuck.score,
    }).eq("id", goalId);

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
      if (!eff.review.efficient) {
        summary += `;efficiency_score:${eff.review.score}`;
        if (eff.cursor_dispatched) summary += ";cursor_optimize_sent";
      }
    }

    await supabase.from("goal_loop_iterations").update({
      status: "completed",
      summary,
      completed_at: new Date().toISOString(),
    }).eq("id", iterationId);

    return { status: finalGate.complete ? "COMPLETED" : nextStatus, summary };
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
  return {
    goal: state.goal,
    criteria: state.criteria,
    plan_steps: state.planSteps,
    blockers: state.blockers.filter((b) => b.status === "open"),
    completion_gate: gate,
    recent_iterations: iterations || [],
    recent_evidence: evidence || [],
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
