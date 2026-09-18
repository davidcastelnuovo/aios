import assert from "node:assert/strict";
import test from "node:test";
import {
  collectTaskAssigneeIds,
  shouldFanOutRecurringTasks,
} from "./recurringTaskAssignees.ts";

test("collectTaskAssigneeIds dedupes primary and collaborators", () => {
  assert.deepEqual(collectTaskAssigneeIds("a", ["b", "c", "a"]), ["a", "b", "c"]);
});

test("shouldFanOutRecurringTasks only when recurring and multiple assignees", () => {
  assert.equal(shouldFanOutRecurringTasks("weekly", ["a", "b"]), true);
  assert.equal(shouldFanOutRecurringTasks("weekly", ["a"]), false);
  assert.equal(shouldFanOutRecurringTasks(null, ["a", "b"]), false);
});
