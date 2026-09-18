/**
 * Apply Cursor Direct brain responses to goal state.
 */

import type { CriterionStatus } from "./autonomous-goal-engine.ts";
import type { BrainRequestRow, BrainRequestType } from "./goal-cursor-brain.ts";
import { extractJsonFromBrainResponse } from "./goal-cursor-brain.ts";
import type { EfficiencyReviewResult } from "./goal-efficiency-review.ts";

type SupabaseLike = { from: (t: string) => any };

export async function applyBrainResponse(
  supabase: SupabaseLike,
  request: BrainRequestRow,
  content: string,
): Promise<{ ok: boolean; error?: string }> {
  const json = extractJsonFromBrainResponse(content);
  if (!json) {
    return { ok: false, error: "no_json_in_response" };
  }

  await supabase.from("goal_brain_requests").update({
    response_json: json,
    status: "completed",
    completed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", request.id);

  switch (request.request_type) {
    case "plan":
      return await applyPlanResponse(supabase, request, json);
    case "step_execute":
      return await applyStepExecuteResponse(supabase, request, json);
    case "efficiency_review":
      return await applyEfficiencyReviewResponse(supabase, request, json);
    default:
      return { ok: false, error: `unknown_request_type:${request.request_type}` };
  }
}

async function applyPlanResponse(
  supabase: SupabaseLike,
  request: BrainRequestRow,
  json: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string }> {
  const steps = Array.isArray(json.plan_steps) ? json.plan_steps : [];
  if (!steps.length) return { ok: false, error: "empty_plan_steps" };

  const { data: goal } = await supabase.from("goals").select("tenant_id, title")
    .eq("id", request.goal_id).maybeSingle();
  if (!goal) return { ok: false, error: "goal_not_found" };

  const slice = steps.slice(0, 8) as Array<Record<string, unknown>>;
  for (const [i, step] of slice.entries()) {
    const actionTypeRaw = String(step.action_type || "model");
    const actionType = ["model", "cursor", "verify", "observe", "tool"].includes(actionTypeRaw)
      ? actionTypeRaw
      : "model";
    const parallelTrack = !!(step.parallel_track && actionType === "cursor" && step.sub_project_key);
    await supabase.from("goal_plan_steps").insert({
      tenant_id: goal.tenant_id,
      goal_id: request.goal_id,
      title: String(step.title || `Step ${i + 1}`),
      description: step.description ? String(step.description) : null,
      action_type: actionType,
      status: "pending",
      priority: Number(step.priority) || 5,
      sort_order: i,
      parallel_track: parallelTrack,
      sub_project_key: parallelTrack ? String(step.sub_project_key) : null,
      sub_project_label: parallelTrack ? String(step.sub_project_label || step.title || "") : null,
      metadata: parallelTrack ? { parallel_track: true } : {},
    });
  }

  await supabase.from("goals").update({
    plan: slice,
    engine_status: "EXECUTING",
    next_run_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", request.goal_id);

  return { ok: true };
}

async function applyStepExecuteResponse(
  supabase: SupabaseLike,
  request: BrainRequestRow,
  json: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string }> {
  const { data: goal } = await supabase.from("goals").select("tenant_id")
    .eq("id", request.goal_id).maybeSingle();
  if (!goal) return { ok: false, error: "goal_not_found" };

  const { data: criteria } = await supabase.from("goal_success_criteria")
    .select("id, criterion_key")
    .eq("goal_id", request.goal_id);

  const evidence = Array.isArray(json.evidence) ? json.evidence : [];
  for (const ev of evidence) {
    const row = ev as Record<string, unknown>;
    const key = row.criterion_key ? String(row.criterion_key) : "";
    const criterion = (criteria || []).find((c: { criterion_key: string }) => c.criterion_key === key);
    await supabase.from("goal_evidence").insert({
      tenant_id: goal.tenant_id,
      goal_id: request.goal_id,
      criterion_id: criterion?.id ?? null,
      evidence_type: String(row.type || "observation"),
      content: (row.content as Record<string, unknown>) || {},
      source_action_id: request.action_id ?? null,
    });
  }

  const updates = Array.isArray(json.criterion_updates) ? json.criterion_updates : [];
  for (const upd of updates) {
    const row = upd as Record<string, unknown>;
    const key = String(row.key || "");
    const status = String(row.status || "");
    const criterion = (criteria || []).find((c: { criterion_key: string }) => c.criterion_key === key);
    if (!criterion) continue;
    if (!["PASS", "FAIL", "UNKNOWN", "NOT_TESTED"].includes(status)) continue;
    await supabase.from("goal_success_criteria").update({
      status: status as CriterionStatus,
      last_verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", criterion.id);
  }

  if (request.action_id) {
    await supabase.from("goal_actions").update({
      status: "completed",
      result: json,
      completed_at: new Date().toISOString(),
    }).eq("id", request.action_id);
  }

  if (request.step_id) {
    await supabase.from("goal_plan_steps").update({
      status: "done",
      completed_at: new Date().toISOString(),
    }).eq("id", request.step_id);
  }

  await supabase.from("goals").update({
    engine_status: "EXECUTING",
    next_run_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", request.goal_id);

  return { ok: true };
}

async function applyEfficiencyReviewResponse(
  supabase: SupabaseLike,
  request: BrainRequestRow,
  json: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string }> {
  const review: EfficiencyReviewResult = {
    efficient: !!json.efficient,
    score: Number(json.score) || 50,
    issues: Array.isArray(json.issues) ? json.issues.map(String) : [],
    optimizations: Array.isArray(json.optimizations) ? json.optimizations.map(String) : [],
    send_to_cursor: !!json.send_to_cursor && !!String(json.cursor_instruction || "").trim(),
    cursor_instruction: String(json.cursor_instruction || "").trim() || undefined,
  };

  if (request.iteration_id) {
    const { data: iter } = await supabase.from("goal_loop_iterations")
      .select("context_snapshot")
      .eq("id", request.iteration_id)
      .maybeSingle();
    const snap = (iter?.context_snapshot as Record<string, unknown>) || {};
    await supabase.from("goal_loop_iterations").update({
      context_snapshot: { ...snap, efficiency_review: review },
    }).eq("id", request.iteration_id);
  }

  let cursorDispatched = false;
  if (review.send_to_cursor && review.cursor_instruction) {
    const { data: goal } = await supabase.from("goals")
      .select("title, objective, constraints")
      .eq("id", request.goal_id)
      .maybeSingle();
    if (goal) {
      try {
        const { dispatchToGoalCursor } = await import("./goal-cursor-dispatch.ts");
        await dispatchToGoalCursor(supabase, {
          tenantId: request.tenant_id,
          goalId: request.goal_id,
          goalTitle: String(goal.title),
          objective: goal.objective,
          stepTitle: "יעילות: אופטימיזציה אחרי איטרציה",
          stepDescription: review.cursor_instruction,
          acceptanceCriteria: review.optimizations.join("\n"),
          constraints: goal.constraints,
        });
        cursorDispatched = true;
      } catch (e) {
        console.warn("[goal-brain-apply] efficiency cursor dispatch failed:", e);
      }
    }
  }

  if (!review.efficient || review.issues.length > 0) {
    await supabase.from("goal_events").insert({
      tenant_id: request.tenant_id,
      goal_id: request.goal_id,
      event_type: "efficiency_review",
      actor: "autonomous_goal_engine",
      detail: { review, cursor_dispatched: cursorDispatched, via: "cursor_direct_brain" },
    });
  }

  await supabase.from("goals").update({
    engine_status: "EXECUTING",
    next_run_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", request.goal_id);

  return { ok: true };
}

export function buildPlanBrainPrompt(ctx: Record<string, unknown>): string {
  return `You are the Cursor Direct orchestration brain for Carmen's autonomous goal engine.
Given this Goal Contract context, output JSON only:
{
  "plan_steps": [
    {
      "title": "...",
      "description": "...",
      "action_type": "model|cursor|verify|observe",
      "priority": 1-10,
      "parallel_track": false,
      "sub_project_key": "optional slug e.g. creative|copy|seo|campaigners",
      "sub_project_label": "optional Hebrew label"
    }
  ],
  "notes": "brief planning notes"
}
Rules:
- Technical/code changes MUST use action_type "cursor".
- Multi-department goals: MULTIPLE cursor steps with parallel_track=true and distinct sub_project_key.
- Non-parallel steps (verify, observe, model) run sequentially.
- Keep 2-8 steps max.
- Delegate execution to per-goal or per-track Cursor agents via plan steps; you orchestrate and monitor.
Context:
${JSON.stringify(ctx, null, 2)}`;
}

export function buildStepExecuteBrainPrompt(
  stepTitle: string,
  stepDescription: string,
  ctx: Record<string, unknown>,
): string {
  return `Execute this plan step for an autonomous goal. Reply JSON only:
{
  "summary": "...",
  "evidence": [{ "criterion_key": "optional", "type": "observation", "content": {} }],
  "criterion_updates": [{ "key": "...", "status": "PASS|FAIL|UNKNOWN|NOT_TESTED", "reason": "..." }]
}
Step: ${stepTitle}
${stepDescription || ""}
Context: ${JSON.stringify(ctx, null, 2)}`;
}

export function buildEfficiencyReviewBrainPrompt(
  metrics: Record<string, unknown>,
  goalTitle: string,
): string {
  return `You are the resource-efficiency reviewer for an autonomous goal loop.
Analyze metrics after one iteration. Reply JSON only:
{
  "efficient": boolean,
  "score": 0-100,
  "issues": ["..."],
  "optimizations": ["..."],
  "send_to_cursor": boolean,
  "cursor_instruction": "optional — only if code/tooling change needed"
}
Rules:
- send_to_cursor=true only for concrete technical optimizations.
Goal: ${goalTitle}
Metrics: ${JSON.stringify(metrics, null, 2)}`;
}
