import assert from "node:assert/strict";
import test from "node:test";

import { getJerusalemDashboardDateRange, jerusalemDateRangeToIso } from "./calendarTimeZone.ts";

test("Jerusalem last_7_days rolling window", () => {
  const now = new Date("2026-08-27T09:00:00Z");
  const calendar = getJerusalemDashboardDateRange("last_7_days", now);
  assert.equal(calendar.startDate, "2026-08-20");
  assert.equal(calendar.endDate, "2026-08-26");
});

test("Jerusalem last_week is previous Sun-Sat", () => {
  const now = new Date("2026-08-31T09:00:00Z");
  const calendar = getJerusalemDashboardDateRange("last_week", now);
  assert.equal(calendar.startDate, "2026-08-23");
  assert.equal(calendar.endDate, "2026-08-29");
  const iso = jerusalemDateRangeToIso(calendar.startDate, calendar.endDate);
  assert.ok(iso.start < iso.end);
});

test("Jerusalem day bounds wrap midnight correctly", () => {
  const iso = jerusalemDateRangeToIso("2026-08-24", "2026-08-24");
  assert.ok(iso.start.includes("2026-08-23") || iso.start.includes("2026-08-24"));
  assert.ok(iso.end.includes("2026-08-24"));
});
