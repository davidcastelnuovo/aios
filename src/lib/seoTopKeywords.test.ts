import assert from "node:assert/strict";
import test from "node:test";
import { isSearchTop20, top20Rank } from "./seoTopKeywords.ts";

test("Top 20 uses the Search Console position even when Ahrefs has another rank", () => {
  const ranked = top20Rank({ position: 2, gsc_position: 14.4 });
  assert.deepEqual(ranked, { rank: 14.4, source: "gsc" });
  assert.equal(isSearchTop20({ position: 2, gsc_position: 14.4 }), true);
});

test("a Search Console rank past 20 stays out even if Ahrefs is inside the top 20", () => {
  assert.equal(isSearchTop20({ position: 4, gsc_position: 28 }), false);
});

test("Ahrefs rank is used only when Search Console has no position", () => {
  assert.deepEqual(top20Rank({ position: 6, gsc_position: null }), { rank: 6, source: "ahrefs" });
  assert.equal(isSearchTop20({ position: null, gsc_position: 1 }), true);
  assert.equal(top20Rank({ position: null, gsc_position: null }), null);
});
