import {
  isParallelCursorStep,
  selectParallelDispatchBatch,
  selectInProgressCursorTracks,
  type ParallelPlanStep,
} from "./goal-parallel-orchestration.ts";

function step(partial: Partial<ParallelPlanStep> & { id: string }): ParallelPlanStep {
  return {
    title: "t",
    status: "pending",
    action_type: "cursor",
    priority: 5,
    sort_order: 0,
    metadata: {},
    ...partial,
  };
}

Deno.test("selectParallelDispatchBatch requires 2+ parallel cursor steps", () => {
  const batch = selectParallelDispatchBatch([
    step({ id: "1", parallel_track: true, sub_project_key: "creative" }),
    step({ id: "2", parallel_track: true, sub_project_key: "copy" }),
  ]);
  if (batch.length !== 2) throw new Error("expected 2");
  const single = selectParallelDispatchBatch([step({ id: "1", parallel_track: true, sub_project_key: "x" })]);
  if (single.length !== 0) throw new Error("expected 0 for single");
});

Deno.test("isParallelCursorStep detects sub_project_key", () => {
  if (!isParallelCursorStep(step({ id: "1", sub_project_key: "seo" }))) {
    throw new Error("expected parallel");
  }
});

Deno.test("selectInProgressCursorTracks finds monitoring rows", () => {
  const rows = selectInProgressCursorTracks([
    step({ id: "1", status: "in_progress", cursor_agent_id: "bc-abc", sub_project_key: "copy" }),
  ]);
  if (rows.length !== 1) throw new Error("expected 1");
});
