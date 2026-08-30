import assert from "node:assert/strict";
import test from "node:test";

import { getDashboardDateRange } from "./dashboardDateFilters.ts";
import { getWooDashboardDateRangeIso } from "./wooDashboardQueries.ts";

test("getWooDashboardDateRangeIso last_7_days matches getDashboardDateRange rolling window", () => {
  const now = new Date(2026, 7, 19, 12, 0, 0);
  const calendar = getDashboardDateRange("last_7_days", now);
  const woo = getWooDashboardDateRangeIso("last_7_days", { now });

  assert.equal(woo.start.slice(0, 10), calendar.startDate);
  assert.equal(woo.end.slice(0, 10), calendar.endDate);
});

test("getWooDashboardDateRangeIso last_7_days is not Sun-Sat week on mid-week dates", () => {
  // Wednesday 2026-08-27 — rolling 7d ends Tue Aug 26; Sun-Sat week would end Sat Aug 23.
  const now = new Date(2026, 7, 27, 12, 0, 0);
  const woo = getWooDashboardDateRangeIso("last_7_days", { now });

  assert.equal(woo.end.slice(0, 10), "2026-08-26");
  assert.equal(woo.start.slice(0, 10), "2026-08-20");
});

test("getWooDashboardDateRangeIso custom range honors customFrom/customTo strings", () => {
  const woo = getWooDashboardDateRangeIso("custom", {
    customFrom: "2026-08-01",
    customTo: "2026-08-10",
    now: new Date(2026, 7, 30),
  });

  assert.equal(woo.start.slice(0, 10), "2026-08-01");
  assert.equal(woo.end.slice(0, 10), "2026-08-10");
});
