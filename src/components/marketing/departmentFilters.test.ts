import assert from "node:assert/strict";
import test from "node:test";
import { filterCreativeDepartmentItems, isCreativeDepartmentItem } from "./departmentFilters.ts";

test("creative items stay visible even without a loaded stage id", () => {
  assert.equal(isCreativeDepartmentItem({ payload: { department: "creative" } }), true);
  assert.equal(isCreativeDepartmentItem({ payload: { handoff_from: "copy" } }), true);
  assert.equal(isCreativeDepartmentItem({ payload: { variations: [{ id: "v1" }] } }), true);
  assert.equal(isCreativeDepartmentItem({ payload: { department: "copy" } }), false);
});

test("filterCreativeDepartmentItems matches a tenant creative stage", () => {
  const items = [
    { id: "copy", payload: { department: "copy" }, current_stage_id: "copy-1" },
    { id: "legacy", payload: {}, current_stage_id: "creative-9" },
    { id: "tagged", payload: { department: "creative" }, current_stage_id: "other" },
  ];
  assert.deepEqual(
    filterCreativeDepartmentItems(items, ["creative-9"]).map((item) => item.id),
    ["legacy", "tagged"],
  );
});
