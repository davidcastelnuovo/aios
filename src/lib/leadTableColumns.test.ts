import assert from "node:assert/strict";
import test from "node:test";
import {
  isLeadTableColumnVisible,
  LEAD_TABLE_COLUMN_FIELDS,
  LEAD_TABLE_TOGGLEABLE_COLUMNS,
} from "./leadTableColumns.ts";

test("name and actions stay visible even when the org hides them", () => {
  const hidden = () => false;
  assert.equal(isLeadTableColumnVisible("contact_name", hidden), true);
  assert.equal(isLeadTableColumnVisible("actions", hidden), true);
});

test("optional columns follow org visibility, defaulting to shown", () => {
  const visibility: Record<string, boolean> = { tags: false };
  const isFieldVisible = (key: string, fallback = true) =>
    key in visibility ? visibility[key] : fallback;

  assert.equal(isLeadTableColumnVisible("tags", isFieldVisible), false);
  assert.equal(isLeadTableColumnVisible("phone", isFieldVisible), true);
});

test("toggleable catalog excludes required columns", () => {
  assert.ok(LEAD_TABLE_TOGGLEABLE_COLUMNS.some((field) => field.key === "tags"));
  assert.ok(!LEAD_TABLE_TOGGLEABLE_COLUMNS.some((field) => field.key === "contact_name"));
  assert.equal(
    LEAD_TABLE_COLUMN_FIELDS.filter((field) => field.required).map((field) => field.key).join(","),
    "contact_name,actions",
  );
});
