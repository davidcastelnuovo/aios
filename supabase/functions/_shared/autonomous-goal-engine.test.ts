import {
  buildContextPackage,
  checkCompletionGate,
  detectStuckPatterns,
  hashInput,
  slugifyKey,
  type AutonomousGoalRow,
  type GoalCriterionRow,
} from "./autonomous-goal-engine.ts";

function criterion(overrides: Partial<GoalCriterionRow> & { criterion_key: string; status: GoalCriterionRow["status"] }): GoalCriterionRow {
  return {
    id: "c1",
    goal_id: "g1",
    tenant_id: "t1",
    description: overrides.criterion_key,
    required: true,
    verification_type: "manual",
    verification_config: {},
    sort_order: 0,
    ...overrides,
  };
}

Deno.test("slugifyKey produces stable keys", () => {
  const k = slugifyKey("דוחות מהירים לכל המשתמשים", 0);
  if (!k.length) throw new Error("empty key");
  if (slugifyKey("test", 0) !== "test") throw new Error("ascii slug");
});

Deno.test("hashInput is deterministic", () => {
  const a = hashInput({ x: 1 });
  const b = hashInput({ x: 1 });
  if (a !== b) throw new Error("hash mismatch");
});

Deno.test("checkCompletionGate requires all required PASS", () => {
  const open = checkCompletionGate([
    criterion({ criterion_key: "a", status: "PASS" }),
    criterion({ criterion_key: "b", status: "NOT_TESTED" }),
  ]);
  if (open.complete) throw new Error("should not complete");

  const done = checkCompletionGate([
    criterion({ criterion_key: "a", status: "PASS" }),
    criterion({ criterion_key: "b", status: "PASS", required: false }),
  ]);
  if (!done.complete) throw new Error("should complete");
});

Deno.test("detectStuckPatterns increments on repeated hash", () => {
  const h = hashInput({ same: true });
  const actions = Array.from({ length: 4 }, () => ({ input_hash: h, status: "failed", error: "e" }));
  const r = detectStuckPatterns(actions, 0);
  if (!r.stuck) throw new Error("expected stuck");
  if (r.score < 4) throw new Error("score too low");
});

Deno.test("buildContextPackage includes objective and criteria", () => {
  const goal: AutonomousGoalRow = {
    id: "g1",
    tenant_id: "t1",
    title: "Title",
    objective: "Objective",
    status: "in_progress",
    engine_status: "EXECUTING",
    autonomous_mode: true,
    constraints: { no_prod: true },
    scope: { module: "reports" },
    risk_level: "READ",
    plan: [],
    iteration_count: 1,
    stuck_score: 0,
    created_at: "",
    updated_at: "",
  };
  const pkg = buildContextPackage({
    goal,
    criteria: [criterion({ criterion_key: "fast", status: "NOT_TESTED" })],
    planSteps: [],
    recentActions: [],
    blockers: [],
  });
  if (pkg.objective !== "Objective") throw new Error("objective missing");
  if (!Array.isArray(pkg.success_criteria)) throw new Error("criteria missing");
});
