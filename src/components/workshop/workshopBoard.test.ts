import assert from "node:assert/strict";
import test from "node:test";
import { boardSteps, workshopFlow } from "./workshopBoard.ts";

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

test("the board spreads one project's steps far enough to pan between them", () => {
  const flow = workshopFlow("כרמן ליד המחשב", { project_type: "video" });
  assert.deepEqual(
    flow.nodes.map((node) => node.id),
    ["project", "images", "copy", "storyboard", "animation"],
  );
  assert.equal(flow.nodes[0].data.label, "כרמן ליד המחשב");
  assert.equal(flow.nodes[0].data.kind, "project");
  assert.equal(flow.nodes[2].data.ready, false);
  assert.ok(flow.nodes[3].position.x - flow.nodes[1].position.x >= 600);
  assert.deepEqual(
    flow.edges.map((edge) => [edge.source, edge.target]),
    [
      ["project", "images"],
      ["images", "copy"],
      ["copy", "storyboard"],
      ["storyboard", "animation"],
    ],
  );
});

test("an empty project has no started steps", () => {
  assert.equal(
    boardSteps(null).some((step) => step.ready),
    false,
  );
});
