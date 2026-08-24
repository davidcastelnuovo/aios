import assert from "node:assert/strict";
import test from "node:test";
import {
  filterEntityAssignmentOptions,
  toggleEntityAssignmentId,
} from "./entityAssignment.ts";

const options = [
  { id: "1", label: "ארבע על ארבע", description: "promo" },
  { id: "2", label: "BEVERTECH", description: "DMM" },
  { id: "3", label: "דוד כהן", description: "david@example.com" },
];

test("search matches Hebrew/English names and descriptions", () => {
  assert.deepEqual(filterEntityAssignmentOptions(options, "ארבע").map((item) => item.id), ["1"]);
  assert.deepEqual(filterEntityAssignmentOptions(options, "bever").map((item) => item.id), ["2"]);
  assert.deepEqual(filterEntityAssignmentOptions(options, "example.com").map((item) => item.id), ["3"]);
});

test("single assignment replaces the previous choice", () => {
  assert.deepEqual(toggleEntityAssignmentId(["1"], "2", false), ["2"]);
});

test("multiple assignment toggles members independently", () => {
  assert.deepEqual(toggleEntityAssignmentId(["1"], "2", true), ["1", "2"]);
  assert.deepEqual(toggleEntityAssignmentId(["1", "2"], "1", true), ["2"]);
});

