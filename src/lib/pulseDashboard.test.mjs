import assert from "node:assert/strict";
import test from "node:test";

import {
  aggregatePulseMetricsFromRecords,
  applyPeriodMetricsToSnapshot,
  buildPulseDashboardUrl,
  clientHasCampaignService,
  formatPulseChange,
  getPulsePeriodBounds,
  pulseSpendColumnLabel,
  pulseStatusToOverall,
} from "./pulseDashboard.ts";

test("maps pulse statuses to traffic lights", () => {
  assert.equal(pulseStatusToOverall("healthy"), "green");
  assert.equal(pulseStatusToOverall("warning"), "yellow");
  assert.equal(pulseStatusToOverall("no_data"), "yellow");
  assert.equal(pulseStatusToOverall("critical"), "red");
});

test("detects campaign services", () => {
  assert.equal(clientHasCampaignService(["seo"]), false);
  assert.equal(clientHasCampaignService(["ppc_meta", "seo"]), true);
  assert.equal(clientHasCampaignService(["ppc_google"]), true);
});

test("formats change and share URLs", () => {
  assert.equal(formatPulseChange(12.5), "+12.5%");
  assert.equal(formatPulseChange(-3), "-3%");
  assert.equal(
    buildPulseDashboardUrl("https://aios.co.il", "marketingcaptain"),
    "https://aios.co.il/marketingcaptain/dmm-dashboard",
  );
  assert.equal(
    buildPulseDashboardUrl("https://aios.co.il/", "marketingcaptain", "abc"),
    "https://aios.co.il/marketingcaptain/dmm-dashboard?agency=abc",
  );
});

test("last_week bounds are previous Sun–Sat (Jerusalem calendar)", () => {
  // Wednesday 2026-08-05 Asia/Jerusalem → last week Sun 2026-07-26 .. Sat 2026-08-01
  const bounds = getPulsePeriodBounds("last_week", new Date("2026-08-05T12:00:00+03:00"));
  assert.equal(bounds.startDate, "2026-07-26");
  assert.equal(bounds.endDate, "2026-08-01");
  assert.equal(bounds.prevStartDate, "2026-07-19");
  assert.equal(bounds.prevEndDate, "2026-07-25");
  assert.equal(bounds.label, "שבוע שעבר");
  assert.equal(pulseSpendColumnLabel("last_week"), "הוצאה שבוע שעבר");
});

test("this_week bounds start on Sunday through today", () => {
  const bounds = getPulsePeriodBounds("this_week", new Date("2026-08-05T12:00:00+03:00"));
  assert.equal(bounds.startDate, "2026-08-02");
  assert.equal(bounds.endDate, "2026-08-05");
});

test("aggregates period metrics and CPL change vs prior window", () => {
  const bounds = getPulsePeriodBounds("last_week", new Date("2026-08-05T12:00:00+03:00"));
  const records = [
    { data: { date: "2026-07-28", spend: 200, leads: 4 } },
    { data: { date: "2026-07-30", spend: 100, leads: 1 } },
    { data: { date: "2026-07-20", spend: 100, leads: 2 } }, // prior week CPL 50
  ];
  const metrics = aggregatePulseMetricsFromRecords(records, bounds, false);
  assert.equal(metrics.spend_7d, 300);
  assert.equal(metrics.leads_7d, 5);
  assert.equal(metrics.cpl_7d, 60);
  // current CPL 60 vs prior 50 → +20%
  assert.equal(metrics.cpl_change_pct, 20);
  assert.equal(metrics.data_fresh_through, "2026-07-30");
});

test("applyPeriodMetricsToSnapshot keeps meta fields", () => {
  const base = {
    client_id: "c1",
    agency_id: null,
    status: "healthy",
    is_ecommerce: false,
    spend_7d: 1,
    leads_7d: 1,
    cpl_7d: 1,
    cpl_change_pct: 0,
    purchases_7d: 0,
    revenue_7d: 0,
    roas_7d: null,
    flags: [],
    data_fresh_through: "2026-08-05",
    calculated_at: "2026-08-05T10:00:00Z",
    last_meta_change_at: "2026-08-01T09:00:00Z",
    last_meta_change_type: "UPDATE",
    last_meta_change_actor: "David",
    last_meta_change_object: "adset",
    meta_change_availability: "ok",
  };
  const next = applyPeriodMetricsToSnapshot(base, {
    spend_7d: 99,
    leads_7d: 3,
    cpl_7d: 33,
    cpl_change_pct: 5,
    purchases_7d: 0,
    revenue_7d: 0,
    roas_7d: null,
    data_fresh_through: "2026-08-01",
    record_count: 2,
  });
  assert.equal(next.spend_7d, 99);
  assert.equal(next.last_meta_change_actor, "David");
  assert.equal(next.status, "healthy");
});
