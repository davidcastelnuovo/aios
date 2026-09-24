import assert from "node:assert/strict";
import test from "node:test";
import {
  applyLeadTableColumnWidths,
  isLeadTableColumnVisible,
  LEAD_TABLE_COLUMN_FIELDS,
  LEAD_TABLE_COLUMN_WIDTHS_STORAGE_KEY,
  LEAD_TABLE_TOGGLEABLE_COLUMNS,
  parseLeadTableColumnWidths,
  readLeadTableColumnWidths,
  writeLeadTableColumnWidths,
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

test("parseLeadTableColumnWidths keeps known CRM columns inside bounds", () => {
  const widths = parseLeadTableColumnWidths(JSON.stringify({
    name: 240.4,
    phone: 10,
    tags: 9000,
    unknown: 300,
    status: "nope",
  }));
  assert.deepEqual(widths, { name: 240, phone: 80, tags: 800 });
});

test("column widths round-trip through storage", () => {
  const saved = new Map<string, string>();
  const storage = {
    getItem: (key: string) => saved.get(key) ?? null,
    setItem: (key: string, value: string) => {
      saved.set(key, value);
    },
  };
  writeLeadTableColumnWidths({ company: 220, nope: 100 }, storage);
  assert.equal(saved.has(LEAD_TABLE_COLUMN_WIDTHS_STORAGE_KEY), true);
  assert.deepEqual(readLeadTableColumnWidths(storage), { company: 220 });
  assert.deepEqual(
    applyLeadTableColumnWidths(
      [{ id: "company", width: 170 }, { id: "phone", width: 130 }],
      readLeadTableColumnWidths(storage),
    ),
    [{ id: "company", width: 220 }, { id: "phone", width: 130 }],
  );
});

test("toggleable catalog excludes required columns", () => {
  assert.ok(LEAD_TABLE_TOGGLEABLE_COLUMNS.some((field) => field.key === "tags"));
  assert.ok(!LEAD_TABLE_TOGGLEABLE_COLUMNS.some((field) => field.key === "contact_name"));
  assert.equal(
    LEAD_TABLE_COLUMN_FIELDS.filter((field) => field.required).map((field) => field.key).join(","),
    "contact_name,actions",
  );
});
