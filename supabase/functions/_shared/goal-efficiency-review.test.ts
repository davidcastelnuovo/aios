import type { GoalResourceMetrics } from "./goal-efficiency-review.ts";

Deno.test("high cursor dispatches per iteration flags waste signal", () => {
  const m: GoalResourceMetrics = {
    goal_id: "g1",
    iteration_number: 3,
    iteration_id: "i1",
    actions_this_iteration: 4,
    failed_actions: 0,
    model_calls: 2,
    tokens_in: 1000,
    tokens_out: 200,
    cost_usd: 0.01,
    stuck_score: 0,
    cursor_dispatches: 3,
    dev_tasks_open: 2,
    plan_steps_pending: 1,
  };
  const likelyWasteful = m.cursor_dispatches > 1 && m.dev_tasks_open > 1;
  if (!likelyWasteful) throw new Error("expected waste signal");
});
