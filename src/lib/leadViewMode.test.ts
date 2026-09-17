import assert from "node:assert/strict";
import test from "node:test";
import {
  parseLeadViewMode,
  readStoredLeadViewMode,
  writeStoredLeadViewMode,
  LEAD_DEFAULT_VIEW_STORAGE_KEY,
  LEAD_VIEW_MODE_STORAGE_KEY,
} from "./leadViewMode.ts";

test("parseLeadViewMode accepts the three CRM views", () => {
  assert.equal(parseLeadViewMode("kanban"), "kanban");
  assert.equal(parseLeadViewMode("table"), "table");
  assert.equal(parseLeadViewMode("chat"), "chat");
  assert.equal(parseLeadViewMode("pipeline"), null);
  assert.equal(parseLeadViewMode(null), null);
});

test("readStoredLeadViewMode prefers the saved default over last used", () => {
  const store = new Map<string, string>();
  const previous = (globalThis as { localStorage?: unknown }).localStorage;
  (globalThis as { localStorage: unknown }).localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
  };
  try {
    store.set(LEAD_VIEW_MODE_STORAGE_KEY, "chat");
    assert.equal(readStoredLeadViewMode(), "chat");
    store.set(LEAD_DEFAULT_VIEW_STORAGE_KEY, "table");
    assert.equal(readStoredLeadViewMode(), "table");
    writeStoredLeadViewMode("kanban", true);
    assert.equal(store.get(LEAD_VIEW_MODE_STORAGE_KEY), "kanban");
    assert.equal(store.get(LEAD_DEFAULT_VIEW_STORAGE_KEY), "kanban");
  } finally {
    (globalThis as { localStorage?: unknown }).localStorage = previous;
  }
});
