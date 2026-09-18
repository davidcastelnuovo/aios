import assert from "node:assert/strict";
import test from "node:test";
import {
  REPORT_MIN_SYNC_DAYS,
  replacedRecordsFilter,
  resolveAdsSyncWindow,
  resolvePruneStart,
  shiftDateString,
  toDateString,
} from "./report-sync-window.ts";

test("a 30-day table still syncs every rolling dashboard preset through 120 days", () => {
  const today = "2026-09-18";
  const window = resolveAdsSyncWindow(
    { startDate: shiftDateString(today, -30), endDate: today },
    today,
  );

  assert.equal(window.startDate, shiftDateString(today, -REPORT_MIN_SYNC_DAYS));
  assert.equal(window.endDate, today);
  assert.equal(REPORT_MIN_SYNC_DAYS, 120);
  assert.ok(window.startDate <= shiftDateString(today, -120));
});

test("a configured range deeper than the minimum is kept", () => {
  const today = "2026-09-18";
  const window = resolveAdsSyncWindow(
    { startDate: "2025-09-18", endDate: today },
    today,
  );

  assert.equal(window.startDate, "2025-09-18");
  assert.equal(window.endDate, today);
});

test("a window ending in the past is extended to today", () => {
  const today = "2026-09-18";
  const window = resolveAdsSyncWindow(
    { startDate: "2026-09-06", endDate: "2026-09-12" },
    today,
  );

  assert.equal(window.endDate, today);
});

test("prune start follows provider rows dated before the requested window", () => {
  const window = { startDate: "2026-06-20", endDate: "2026-09-18" };

  assert.equal(resolvePruneStart(window, ["2026-07-01", "2026-09-17"]), "2026-06-20");
  assert.equal(resolvePruneStart(window, ["2026-06-19", "2026-09-17"]), "2026-06-19");
  assert.equal(resolvePruneStart(window, ["", null, undefined, "not-a-date"]), "2026-06-20");
  assert.equal(resolvePruneStart(window, ["2026-06-18T00:00:00Z"]), "2026-06-18");
});

test("prune filter clears the rewritten window and undated rows but keeps older history", () => {
  const filter = replacedRecordsFilter("2026-06-20");

  assert.deepEqual(filter.split(","), [
    "data->>date.gte.2026-06-20",
    "data->>date.is.null",
    "data->>date.lt.1900-01-01",
  ]);
});

test("toDateString uses the calendar day, not the UTC instant", () => {
  assert.equal(toDateString(new Date(2026, 8, 18, 23, 30)), "2026-09-18");
  assert.equal(toDateString(new Date(2026, 0, 1, 0, 0)), "2026-01-01");
});
