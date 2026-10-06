import assert from "node:assert/strict";
import test from "node:test";
import {
  REPORT_MIN_SYNC_DAYS,
  SCHEDULED_CATCHUP_DAYS,
  jerusalemToday,
  planScheduledSyncWindows,
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

const FULL_HISTORY = (today: string) => shiftDateString(today, -REPORT_MIN_SYNC_DAYS);

test("the morning run fetches yesterday and today after yesterday's afternoon run", () => {
  const plan = planScheduledSyncWindows("2026-10-06", FULL_HISTORY("2026-10-06"), "2026-10-05");

  assert.deepEqual(plan.refresh, { startDate: "2026-10-05", endDate: "2026-10-06" });
  assert.equal(plan.catchup, null);
  assert.equal(plan.syncedThrough, "2026-10-06");
});

test("the afternoon run fetches only today after this morning's run", () => {
  const plan = planScheduledSyncWindows("2026-10-06", FULL_HISTORY("2026-10-06"), "2026-10-06");

  assert.deepEqual(plan.refresh, { startDate: "2026-10-06", endDate: "2026-10-06" });
  assert.equal(plan.catchup, null);
});

test("missed runs are filled from the last successful day", () => {
  const plan = planScheduledSyncWindows("2026-10-06", FULL_HISTORY("2026-10-06"), "2026-10-02");

  assert.deepEqual(plan.refresh, { startDate: "2026-10-02", endDate: "2026-10-06" });
});

test("a gap never reaches past the 120-day floor", () => {
  const today = "2026-10-06";
  const plan = planScheduledSyncWindows(today, FULL_HISTORY(today), "2025-01-01");

  assert.equal(plan.refresh.startDate, FULL_HISTORY(today));
});

test("without a run marker the run covers yesterday and today", () => {
  for (const marker of [null, undefined, "not-a-date"]) {
    const plan = planScheduledSyncWindows("2026-10-06", FULL_HISTORY("2026-10-06"), marker);
    assert.deepEqual(plan.refresh, { startDate: "2026-10-05", endDate: "2026-10-06" });
  }
});

test("a marker after today is clamped to today", () => {
  const plan = planScheduledSyncWindows("2026-10-06", FULL_HISTORY("2026-10-06"), "2026-10-07");

  assert.deepEqual(plan.refresh, { startDate: "2026-10-06", endDate: "2026-10-06" });
});

test("history is caught up one older slice per run until 120 days are covered", () => {
  const today = "2026-10-04";
  const first = planScheduledSyncWindows(today, null, "2026-10-04");

  assert.deepEqual(first.refresh, { startDate: today, endDate: today });
  assert.ok(first.catchup);
  assert.equal(first.catchup.endDate, shiftDateString(today, -1));
  assert.equal(first.catchup.startDate, shiftDateString(today, -SCHEDULED_CATCHUP_DAYS));
  assert.equal(first.historyFrom, first.catchup.startDate);

  const next = planScheduledSyncWindows(today, first.historyFrom, "2026-10-04");
  assert.ok(next.catchup);
  assert.equal(next.catchup.endDate, shiftDateString(first.historyFrom, -1));
  assert.ok(next.historyFrom < first.historyFrom);

  let historyFrom: string | null = null;
  for (let run = 0; run < 10; run++) {
    const plan = planScheduledSyncWindows(today, historyFrom, today);
    if (!plan.catchup) break;
    assert.ok(plan.catchup.startDate >= FULL_HISTORY(today));
    historyFrom = plan.historyFrom;
  }
  assert.equal(historyFrom, FULL_HISTORY(today));
  assert.equal(planScheduledSyncWindows(today, historyFrom, today).catchup, null);
});

test("a garbage history marker is treated as uncovered", () => {
  const today = "2026-10-04";
  const plan = planScheduledSyncWindows(today, "not-a-date", today);
  assert.ok(plan.catchup);
  assert.equal(plan.historyFrom, plan.catchup.startDate);
});

test("jerusalemToday follows the Israel calendar across midnight UTC", () => {
  assert.equal(jerusalemToday(new Date("2026-10-03T21:30:00Z")), "2026-10-04");
  assert.equal(jerusalemToday(new Date("2026-10-03T20:30:00Z")), "2026-10-03");
});

test("toDateString uses the calendar day, not the UTC instant", () => {
  assert.equal(toDateString(new Date(2026, 8, 18, 23, 30)), "2026-09-18");
  assert.equal(toDateString(new Date(2026, 0, 1, 0, 0)), "2026-01-01");
});
