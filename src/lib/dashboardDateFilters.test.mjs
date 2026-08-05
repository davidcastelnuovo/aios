import assert from "node:assert/strict";
import test from "node:test";

import {
  ADS_TABLE_CREATE_DATE_RANGE_OPTIONS,
  COMBINED_DASHBOARD_DATE_FILTERS,
  REQUIRED_COMBINED_DATE_FILTERS,
  SHARED_COMBINED_DASHBOARD_DATE_FILTERS,
  SHARED_TABLE_DATE_FILTERS,
  assertCombinedDateFilters,
  dateFilterHasOption,
  getDashboardDateRange,
} from "./dashboardDateFilters.ts";

const SURFACES = [
  ["COMBINED_DASHBOARD_DATE_FILTERS", COMBINED_DASHBOARD_DATE_FILTERS],
  ["SHARED_COMBINED_DASHBOARD_DATE_FILTERS", SHARED_COMBINED_DASHBOARD_DATE_FILTERS],
  ["SHARED_TABLE_DATE_FILTERS", SHARED_TABLE_DATE_FILTERS],
  ["ADS_TABLE_CREATE_DATE_RANGE_OPTIONS", ADS_TABLE_CREATE_DATE_RANGE_OPTIONS],
];

for (const [name, options] of SURFACES) {
  test(`${name} keeps שבוע שעבר + השבוע`, () => {
    assertCombinedDateFilters(options, name);
    assert.equal(dateFilterHasOption(options, "last_week", "שבוע שעבר"), true);
    assert.equal(dateFilterHasOption(options, "this_week", "השבוע"), true);
  });
}

test("REQUIRED_COMBINED_DATE_FILTERS lists Hebrew week labels", () => {
  assert.deepEqual(
    [...REQUIRED_COMBINED_DATE_FILTERS],
    [
      { value: "this_week", label: "השבוע" },
      { value: "last_week", label: "שבוע שעבר" },
    ],
  );
});

test("assertCombinedDateFilters fails when week presets are dropped", () => {
  assert.throws(
    () => assertCombinedDateFilters([{ value: "today", label: "היום" }], "broken"),
    /missing required date filter/,
  );
});

test("getDashboardDateRange last_week is previous Sun–Sat", () => {
  // Wednesday 2026-08-05 local → last week Sun 2026-07-26 .. Sat 2026-08-01
  const range = getDashboardDateRange("last_week", new Date(2026, 7, 5, 12, 0, 0));
  assert.equal(range.startDate, "2026-07-26");
  assert.equal(range.endDate, "2026-08-01");
});

test("getDashboardDateRange this_week is Sun through today", () => {
  const range = getDashboardDateRange("this_week", new Date(2026, 7, 5, 12, 0, 0));
  assert.equal(range.startDate, "2026-08-02");
  assert.equal(range.endDate, "2026-08-05");
});

test("no duplicate values in combined / shared preset lists", () => {
  for (const [name, options] of SURFACES) {
    const values = options.map((o) => o.value);
    assert.equal(new Set(values).size, values.length, `${name} has duplicate values`);
  }
});
