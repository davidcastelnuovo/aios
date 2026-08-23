import assert from "node:assert/strict";
import test from "node:test";
import { defaultTaskFilters } from "./taskFilters.ts";

test("the tasks board opens on my own tasks", () => {
  assert.equal(defaultTaskFilters.campaignerId, "mine");
});

test("no other filter narrows the board on entry", () => {
  assert.equal(defaultTaskFilters.taskType, "all");
  assert.equal(defaultTaskFilters.association, "all");
  assert.equal(defaultTaskFilters.startDate, undefined);
  assert.equal(defaultTaskFilters.endDate, undefined);
});
