/**
 * Post-iteration efficiency review — Carmen measures resource use and asks Cursor to optimize.
 */

import { dispatchToGoalCursor } from "./goal-cursor-dispatch.ts";
import { modelRouterJSON } from "./model-router.ts";
import { buildEfficiencyReviewBrainPrompt } from "./goal-brain-apply.ts";
import {
  getInFlightBrainRequest,
  goalBrainApiFallbackEnabled,
  queueBrainRequest,
} from "./goal-cursor-brain.ts";

export type GoalResourceMetrics = {
  goal_id: string;
  iteration_number: number;
  iteration_id: string;
  actions_this_iteration: number;
  failed_actions: number;
  model_calls: number;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
  stuck_score: number;
  cursor_dispatches: number;
  dev_tasks_open: number;
  plan_steps_pending: number;
};

export async function collectGoalResourceMetrics(
  supabase: { from: (t: string) => any },
  tenantId: string,
  goalId: string,
  iterationId: string,
  iterationNumber: number,
  stuckScore: number,
): Promise<GoalResourceMetrics> {
  const [{ data: actions }, { data: modelEvents }, { data: devTasks }, { data: planSteps }] = await Promise.all([
    supabase.from("goal_actions").select("status, action_type").eq("iteration_id", iterationId),
    supabase.from("goal_model_events").select("tokens_in, tokens_out, cost_usd").eq("iteration_id", iterationId),
    supabase.from("dev_tasks").select("id, status").eq("goal_id", goalId).eq("tenant_id", tenantId),
    supabase.from("goal_plan_steps").select("status").eq("goal_id", goalId).in("status", ["pending", "in_progress"]),
  ]);

  const actionRows = actions || [];
  const modelRows = modelEvents || [];
  const openDev = (devTasks || []).filter((d: { status: string }) =>
    !["done", "cancelled"].includes(d.status),
  );

  return {
    goal_id: goalId,
    iteration_number: iterationNumber,
    iteration_id: iterationId,
    actions_this_iteration: actionRows.length,
    failed_actions: actionRows.filter((a: { status: string }) => a.status === "failed").length,
    model_calls: modelRows.length,
    tokens_in: modelRows.reduce((s: number, r: { tokens_in?: number }) => s + (r.tokens_in || 0), 0),
    tokens_out: modelRows.reduce((s: number, r: { tokens_out?: number }) => s + (r.tokens_out || 0), 0),
    cost_usd: modelRows.reduce((s: number, r: { cost_usd?: number }) => s + Number(r.cost_usd || 0), 0),
    stuck_score: stuckScore,
    cursor_dispatches: actionRows.filter((a: { action_type?: string }) => a.action_type === "cursor").length,
    dev_tasks_open: openDev.length,
    plan_steps_pending: (planSteps || []).length,
  };
}

export type EfficiencyReviewResult = {
  efficient: boolean;
  score: number;
  issues: string[];
  optimizations: string[];
  send_to_cursor: boolean;
  cursor_instruction?: string;
};

export async function reviewIterationEfficiency(
  metrics: GoalResourceMetrics,
  goalTitle: string,
): Promise<EfficiencyReviewResult> {
  const prompt = `You are Carmen's resource-efficiency reviewer for an autonomous goal loop.
Analyze these metrics after one iteration and reply JSON only:
{
  "efficient": boolean,
  "score": 0-100,
  "issues": ["..."],
  "optimizations": ["..."],
  "send_to_cursor": boolean,
  "cursor_instruction": "optional concrete instruction to Cursor to refactor/optimize code or workflow — only if technical optimization is needed"
}
Rules:
- send_to_cursor=true only when a concrete code/tooling change would materially reduce waste (duplicate agents, redundant calls, batching opportunities).
- cursor_instruction must be self-contained and actionable.
- Prefer batching, reuse, fewer round-trips, shared utilities.
Goal: ${goalTitle}
Metrics: ${JSON.stringify(metrics, null, 2)}`;

  const result = await modelRouterJSON<EfficiencyReviewResult>("FAST_REASON", prompt);
  if (!result.ok || !result.data) {
    return {
      efficient: true,
      score: 70,
      issues: [],
      optimizations: [],
      send_to_cursor: false,
    };
  }
  return {
    efficient: !!result.data.efficient,
    score: Number(result.data.score) || 50,
    issues: result.data.issues || [],
    optimizations: result.data.optimizations || [],
    send_to_cursor: !!result.data.send_to_cursor && !!result.data.cursor_instruction?.trim(),
    cursor_instruction: result.data.cursor_instruction?.trim(),
  };
}

export async function runPostIterationEfficiencyReview(
  supabase: { from: (t: string) => any },
  args: {
    tenantId: string;
    goalId: string;
    goalTitle: string;
    objective?: string;
    iterationId: string;
    iterationNumber: number;
    stuckScore: number;
    constraints?: Record<string, unknown>;
  },
): Promise<{
  metrics: GoalResourceMetrics;
  review?: EfficiencyReviewResult;
  cursor_dispatched: boolean;
  awaiting_brain?: boolean;
}> {
  const metrics = await collectGoalResourceMetrics(
    supabase,
    args.tenantId,
    args.goalId,
    args.iterationId,
    args.iterationNumber,
    args.stuckScore,
  );

  const inflight = await getInFlightBrainRequest(supabase, args.goalId, "efficiency_review");
  if (inflight) {
    return { metrics, cursor_dispatched: false, awaiting_brain: true };
  }

  const prompt = buildEfficiencyReviewBrainPrompt(metrics as unknown as Record<string, unknown>, args.goalTitle);
  const queued = await queueBrainRequest(supabase, {
    tenantId: args.tenantId,
    goalId: args.goalId,
    requestType: "efficiency_review",
    prompt,
    iterationId: args.iterationId,
  });

  if (queued.dispatched || queued.awaiting) {
    await supabase.from("goal_loop_iterations").update({
      context_snapshot: { resource_metrics: metrics, efficiency_review_pending: true },
    }).eq("id", args.iterationId);
    return { metrics, cursor_dispatched: false, awaiting_brain: true };
  }

  if (!goalBrainApiFallbackEnabled()) {
    return { metrics, cursor_dispatched: false };
  }

  const review = await reviewIterationEfficiency(metrics, args.goalTitle);
  await supabase.from("goal_loop_iterations").update({
    context_snapshot: { resource_metrics: metrics, efficiency_review: review },
  }).eq("id", args.iterationId);

  let cursorDispatched = false;
  if (review.send_to_cursor && review.cursor_instruction) {
    try {
      await dispatchToGoalCursor(supabase, {
        tenantId: args.tenantId,
        goalId: args.goalId,
        goalTitle: args.goalTitle,
        objective: args.objective,
        stepTitle: "יעילות: אופטימיזציה אחרי איטרציה",
        stepDescription: review.cursor_instruction,
        acceptanceCriteria: review.optimizations.join("\n"),
        constraints: args.constraints,
      });
      cursorDispatched = true;
    } catch (e) {
      console.warn("[goal-efficiency-review] cursor dispatch failed:", e);
    }
  }

  if (!review.efficient || review.issues.length > 0) {
    await supabase.from("goal_events").insert({
      tenant_id: args.tenantId,
      goal_id: args.goalId,
      event_type: "efficiency_review",
      actor: "autonomous_goal_engine",
      detail: { metrics, review, cursor_dispatched: cursorDispatched, via: "api_fallback" },
    });
  }

  return { metrics, review, cursor_dispatched: cursorDispatched };
}
