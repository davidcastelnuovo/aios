import {
  extractJsonFromBrainResponse,
  buildGoalBrainCallbackBlock,
} from "./goal-cursor-brain.ts";

Deno.test("extractJsonFromBrainResponse parses fenced JSON", () => {
  const raw = 'Here is the plan:\n```json\n{"plan_steps":[{"title":"A"}]}\n```';
  const parsed = extractJsonFromBrainResponse(raw);
  if (!parsed?.plan_steps) throw new Error("expected plan_steps");
  if (!Array.isArray(parsed.plan_steps)) throw new Error("plan_steps not array");
});

Deno.test("extractJsonFromBrainResponse parses bare JSON", () => {
  const parsed = extractJsonFromBrainResponse('{"efficient":true,"score":90}');
  if (!parsed?.efficient) throw new Error("expected efficient");
});

Deno.test("buildGoalBrainCallbackBlock includes callback URL", () => {
  const block = buildGoalBrainCallbackBlock({
    requestId: "req-1",
    tenantId: "t1",
    goalId: "g1",
    token: "tok",
  });
  if (!block.includes("goal-brain-callback")) throw new Error("missing callback path");
  if (!block.includes("req-1")) throw new Error("missing request id");
});
