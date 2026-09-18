import assert from "node:assert/strict";
import test from "node:test";
import { formatReportDate, getReportCoverageGap } from "./reportCoverage.ts";

test("a 70-day window over 30 days of stored ads data reports the shortfall", () => {
  const gap = getReportCoverageGap("2026-07-10", ["2026-08-19", "2026-09-01", "2026-09-17"]);

  assert.deepEqual(gap, { earliestAvailable: "2026-08-19", uncoveredDays: 40 });
});

test("a window fully covered by stored data reports no gap", () => {
  assert.equal(getReportCoverageGap("2026-08-19", ["2026-08-19", "2026-09-17"]), null);
  assert.equal(getReportCoverageGap("2026-08-19", ["2026-07-01", "2026-09-17"]), null);
});

test("normal sync lag of a day or two is not reported as a gap", () => {
  assert.equal(getReportCoverageGap("2026-09-15", ["2026-09-16", "2026-09-17"]), null);
});

test("missing or malformed dates are ignored", () => {
  assert.equal(getReportCoverageGap(null, ["2026-09-17"]), null);
  assert.equal(getReportCoverageGap("2026-07-10", ["", null, undefined, "not-a-date"]), null);
  assert.deepEqual(getReportCoverageGap("2026-07-10", ["2026-08-19T00:00:00Z", null]), {
    earliestAvailable: "2026-08-19",
    uncoveredDays: 40,
  });
});

test("dates render the way the reports display them", () => {
  assert.equal(formatReportDate("2026-08-19"), "19/08/2026");
});
