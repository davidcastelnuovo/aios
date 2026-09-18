import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { requireAuth } from "../_shared/security.ts";
import {
  addGoalBlocker,
  addGoalMilestone,
  createUnifiedGoal,
  findDuplicateGoals,
  getGoalExecutionReport,
  linkTaskToGoal,
  logGoalEvent,
} from "../_shared/goal-execution.ts";
import {
  getAutonomousGoalStatus,
  runGoalIteration,
} from "../_shared/autonomous-goal-engine.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const auth = await requireAuth(req);
    if (!auth) {
      return json({ error: "Unauthorized" }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");
    const tenantId = String(body.tenant_id || "").trim();
    if (!tenantId) return json({ error: "tenant_id required" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const userId = auth.kind === "user" ? auth.userId : null;

    if (action === "list") {
      let q = supabase.from("goals").select("*")
        .eq("tenant_id", tenantId)
        .eq("execution_mode", true)
        .order("updated_at", { ascending: false });
      if (body.status) q = q.eq("status", body.status);
      const { data, error } = await q.limit(Math.min(Number(body.limit) || 50, 100));
      if (error) throw error;
      return json({ goals: data || [] });
    }

    if (action === "get") {
      const id = String(body.id || "");
      const report = await getGoalExecutionReport(supabase, tenantId, id);
      const { data: events } = await supabase.from("goal_events").select("*")
        .eq("goal_id", id).order("created_at", { ascending: false }).limit(40);
      return json({ ...report, events: events || [] });
    }

    if (action === "find_duplicates") {
      const title = String(body.title || "").trim();
      if (!title) return json({ duplicates: [] });
      const duplicates = await findDuplicateGoals(supabase, tenantId, title);
      return json({ duplicates: duplicates.map((d) => ({ id: d.goal.id, title: d.goal.title, status: d.goal.status, score: d.score })) });
    }

    if (action === "create" || action === "autonomous_create") {
      const title = String(body.title || "").trim();
      if (!title) throw new Error("title required");
      const autonomous = action === "autonomous_create" || !!body.autonomous;
      const duplicates = await findDuplicateGoals(supabase, tenantId, title);
      const created = await createUnifiedGoal(supabase, {
        tenantId,
        title,
        description: body.description,
        dueDate: body.due_date,
        priority: body.priority,
        completionCriteria: body.completion_criteria,
        nextAction: body.next_action,
        ownerUserId: userId,
        actorUserId: userId,
        autonomous,
        objective: body.objective,
        constraints: body.constraints,
        scope: body.scope,
        riskLevel: body.risk_level,
        successCriteria: body.success_criteria,
        agentId: body.agent_id,
      });
      const { goal, criteria, autonomous_deferred, notice } = created;
      if (!autonomous && body.milestones && Array.isArray(body.milestones)) {
        for (const [i, m] of body.milestones.entries()) {
          if (m?.title) {
            await addGoalMilestone(supabase, {
              tenantId, goalId: goal.id, title: String(m.title),
              description: m.description, dueDate: m.due_date, sortOrder: i, actorUserId: userId,
            });
          }
        }
      }
      return json({
        goal,
        criteria,
        possible_duplicates: duplicates.slice(0, 5),
        autonomous_deferred,
        notice,
      });
    }

    if (action === "update") {
      const id = String(body.id || "");
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      for (const key of ["title", "description", "status", "priority", "due_date", "next_action", "completion_criteria", "progress_percent"]) {
        if (body[key] !== undefined) patch[key] = body[key];
      }
      const { data, error } = await supabase.from("goals").update(patch)
        .eq("id", id).eq("tenant_id", tenantId).select("*").single();
      if (error) throw error;
      await logGoalEvent(supabase, { goalId: id, tenantId, eventType: "updated", actorUserId: userId, detail: patch });
      return json({ goal: data });
    }

    if (action === "add_milestone") {
      const milestone = await addGoalMilestone(supabase, {
        tenantId,
        goalId: String(body.goal_id),
        title: String(body.title),
        description: body.description,
        dueDate: body.due_date,
        sortOrder: body.sort_order,
        actorUserId: userId,
      });
      return json({ milestone });
    }

    if (action === "add_blocker") {
      const blocker = await addGoalBlocker(supabase, {
        tenantId,
        goalId: String(body.goal_id),
        title: String(body.title),
        description: body.description,
        actorUserId: userId,
      });
      return json({ blocker });
    }

    if (action === "resolve_blocker") {
      const blockerId = String(body.blocker_id || "");
      const { data, error } = await supabase.from("goal_blockers").update({
        status: "resolved", resolved_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }).eq("id", blockerId).eq("tenant_id", tenantId).select("*").single();
      if (error) throw error;
      await logGoalEvent(supabase, {
        goalId: data.goal_id, tenantId, eventType: "blocker_resolved", actorUserId: userId,
        detail: { blocker_id: blockerId },
      });
      return json({ blocker: data });
    }

    if (action === "link_task") {
      const task = await linkTaskToGoal(supabase, {
        tenantId, goalId: String(body.goal_id), taskId: String(body.task_id), actorUserId: userId,
      });
      return json({ task });
    }

    if (action === "report") {
      const report = await getGoalExecutionReport(supabase, tenantId, String(body.id), Number(body.since_hours) || 24);
      return json({ report });
    }

    if (action === "autonomous_status") {
      const id = String(body.id || body.goal_id || "");
      if (!id) return json({ error: "id required" }, 400);
      const report = await getGoalExecutionReport(supabase, tenantId, id);
      return json(report);
    }

    if (action === "manual_guidance") {
      const goalId = String(body.goal_id || body.id || "");
      const guidance = String(body.guidance || body.message || "").trim();
      if (!goalId || !guidance) return json({ error: "goal_id and guidance required" }, 400);

      const { data: goal } = await supabase.from("goals").select("*")
        .eq("id", goalId).eq("tenant_id", tenantId).eq("autonomous_mode", true).maybeSingle();
      if (!goal) return json({ error: "autonomous goal not found" }, 404);

      await logGoalEvent(supabase, {
        goalId,
        tenantId,
        eventType: "manual_guidance",
        actorUserId: userId,
        detail: { guidance: guidance.slice(0, 2000) },
      });

      const { loadGoalState, buildContextPackage } = await import("../_shared/autonomous-goal-engine.ts");
      const { queueBrainRequest } = await import("../_shared/goal-cursor-brain.ts");
      const { buildManualGuidanceBrainPrompt } = await import("../_shared/goal-brain-apply.ts");

      const state = await loadGoalState(supabase, tenantId, goalId);
      const ctx = state ? buildContextPackage(state) : { goal_id: goalId };
      const queued = await queueBrainRequest(supabase, {
        tenantId,
        goalId,
        requestType: "manual_guidance",
        prompt: buildManualGuidanceBrainPrompt({ guidance, ctx }),
      });

      return json({
        ok: true,
        dispatched: queued.dispatched,
        awaiting: queued.awaiting,
        request_id: queued.requestId,
        reason: queued.reason,
      });
    }

    if (action === "autonomous_run_iteration" || action === "run_iteration") {
      const id = String(body.id || body.goal_id || "");
      if (!id) return json({ error: "id required" }, 400);
      const holder = userId ? `user:${userId}` : "api";
      const outcome = await runGoalIteration(supabase, tenantId, id, holder);
      const status = await getAutonomousGoalStatus(supabase, tenantId, id);
      return json({ outcome, status });
    }

    return json({ error: `unknown action: ${action}` }, 400);
  } catch (e: unknown) {
    console.error("[goal-execution-center]", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
