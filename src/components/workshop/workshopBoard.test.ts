import assert from "node:assert/strict";
import test from "node:test";
import { boardSteps } from "./workshopBoard.ts";

test("a video project shows storyboard and a running film as started", () => {
  const steps = boardSteps({
    project_type: "video",
    copy_text: "שלום",
    video: { production: { status: "running" } },
  });
  assert.deepEqual(
    steps.map((step) => [step.id, step.ready]),
    [
      ["images", false],
      ["copy", true],
      ["storyboard", true],
      ["animation", true],
    ],
  );
});

test("an empty project has no started steps", () => {
  assert.equal(
    boardSteps(null).some((step) => step.ready),
    false,
  );
});
