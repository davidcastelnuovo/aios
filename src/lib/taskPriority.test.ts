import assert from "node:assert/strict";
import test from "node:test";
import { priorityBarColor } from "./taskPriority.ts";

test("priority bar goes blue → green → yellow → orange → red", () => {
  assert.equal(priorityBarColor(1), "#3b82f6");
  assert.equal(priorityBarColor(2), "#3b82f6");
  assert.equal(priorityBarColor(3), "#22c55e");
  assert.equal(priorityBarColor(5), "#eab308");
  assert.equal(priorityBarColor(8), "#f97316");
  assert.equal(priorityBarColor(10), "#ef4444");
});
