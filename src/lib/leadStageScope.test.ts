import assert from "node:assert/strict";
import test from "node:test";
import {
  LEAD_STAGE_SCOPE_STORAGE_KEY,
  parseLeadStageScope,
  readStoredLeadStageScope,
  writeStoredLeadStageScope,
} from "./leadStageScope.ts";

test("parseLeadStageScope accepts all or new", () => {
  assert.equal(parseLeadStageScope("all"), "all");
  assert.equal(parseLeadStageScope("new"), "new");
  assert.equal(parseLeadStageScope("kanban"), null);
  assert.equal(parseLeadStageScope(null), null);
});

test("stage scope stays unset until the user saves one", () => {
  const store = new Map<string, string>();
  const previous = (globalThis as { localStorage?: unknown }).localStorage;
  (globalThis as { localStorage: unknown }).localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
  };
  try {
    assert.equal(readStoredLeadStageScope(), null);
    writeStoredLeadStageScope("all");
    assert.equal(store.get(LEAD_STAGE_SCOPE_STORAGE_KEY), "all");
    assert.equal(readStoredLeadStageScope(), "all");
  } finally {
    (globalThis as { localStorage?: unknown }).localStorage = previous;
  }
});
