import type { GoalResourceMetrics } from "./goal-efficiency-review.ts";

Deno.test("metrics shape supports efficiency heuristics", () => {
  const m: GoalResourceMetrics = {
    goal_id: "g1",
    iteration_number: 3,
    iteration_id: "i1",
    actions_this_iteration: 4,
    failed_actions: 1,
    model_calls: 2,
    tokens_in: 1000,
    tokens_out: 200,
    cost_usd: 0.01,
    stuck_score: 2,
    cursor_dispatches: 2,
    dev_tasks_open: 1,
    plan_steps_pending: 2,
  };
  if (m.cursor_dispatches > 1 && m.iteration_number > 1) {
    // heuristic: multiple cursor dispatches per iteration suggests inefficiency
    if (m.cursor_dispatches < 2) throw new Error("expected multiple dispatches");
  }
});
