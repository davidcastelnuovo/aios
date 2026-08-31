import assert from "node:assert/strict";
import test from "node:test";

import {
  filterWooOrdersForRevenue,
  isWooOrderInRevenueRange,
  sumWooRevenue,
  wooOrderRevenueTimestamp,
} from "./wooOrderRevenue.ts";

test("woo revenue date prefers date_paid over date_created", () => {
  assert.equal(
    wooOrderRevenueTimestamp({
      date_created: "2026-08-10T10:00:00Z",
      date_paid: "2026-08-25T12:00:00Z",
    }),
    "2026-08-25T12:00:00Z",
  );
});

test("paid-last-week order counts even if created earlier", () => {
  const range = {
    start: "2026-08-24T00:00:00.000Z",
    end: "2026-08-30T23:59:59.999Z",
  };
  const order = {
    id: "1",
    status: "completed",
    total: 500,
    date_created: "2026-08-05T10:00:00Z",
    date_paid: "2026-08-26T08:00:00Z",
  };
  assert.equal(isWooOrderInRevenueRange(order, range), true);
  assert.equal(sumWooRevenue(filterWooOrdersForRevenue([order], range)), 500);
});

test("created-last-week but paid later is excluded from last-week revenue", () => {
  const range = {
    start: "2026-08-24T00:00:00.000Z",
    end: "2026-08-30T23:59:59.999Z",
  };
  const order = {
    id: "2",
    status: "completed",
    total: 300,
    date_created: "2026-08-25T10:00:00Z",
    date_paid: "2026-09-01T08:00:00Z",
  };
  assert.equal(isWooOrderInRevenueRange(order, range), false);
  assert.equal(sumWooRevenue(filterWooOrdersForRevenue([order], range)), 0);
});
