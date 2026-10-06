/**
 * autonomous-goal-worker — cron-driven loop for Carmen Autonomous Goal Engine (Phase 1).
 * Picks due goals, runs one iteration each, persists state for recovery.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { listDueAutonomousGoals, runGoalIteration } from "../_shared/autonomous-goal-engine.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOCK_HOLDER = "autonomous-goal-worker";
const BATCH_LIMIT = 8;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const goals = await listDueAutonomousGoals(supabase, BATCH_LIMIT);
    const results: Array<{ goal_id: string; tenant_id: string; status: string; summary: string }> = [];

    for (const goal of goals) {
      const outcome = await runGoalIteration(supabase, goal.tenant_id, goal.id, LOCK_HOLDER);
      results.push({
        goal_id: goal.id,
        tenant_id: goal.tenant_id,
        status: outcome.status,
        summary: outcome.summary,
      });
    }

    return new Response(JSON.stringify({
      processed: results.length,
      results,
      at: new Date().toISOString(),
    }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[autonomous-goal-worker]", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
