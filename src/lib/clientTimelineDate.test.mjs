import assert from "node:assert/strict";
import test from "node:test";

import { normalizeOptionalClientDate } from "./clientTimelineDate.mjs";

test("normalizeOptionalClientDate clears empty strings", () => {
  assert.equal(normalizeOptionalClientDate(""), null);
  assert.equal(normalizeOptionalClientDate("   "), null);
  assert.equal(normalizeOptionalClientDate(null), null);
  assert.equal(normalizeOptionalClientDate(undefined), null);
});

test("normalizeOptionalClientDate preserves valid dates", () => {
  assert.equal(normalizeOptionalClientDate("2026-09-01"), "2026-09-01");
});
