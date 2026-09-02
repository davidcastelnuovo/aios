import assert from "node:assert/strict";
import test from "node:test";
import { normalizeTitle, titleSimilarity } from "./devTasksDedup.ts";

test("titleSimilarity finds overlapping dev task titles", () => {
  const a = "Fix WooCommerce revenue sync for client 4/4";
  const b = "WooCommerce revenue not syncing for 4/4 client";
  assert.ok(titleSimilarity(a, b) >= 0.4);
  assert.equal(titleSimilarity(a, a), 1);
});

test("normalizeTitle strips punctuation", () => {
  assert.equal(normalizeTitle("  Hello, World!  "), "hello world");
});
