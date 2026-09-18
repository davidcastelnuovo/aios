import assert from "node:assert/strict";
import test from "node:test";
import {
  buildWeeklyCampaignSections,
  formatWeeklyRange,
  getSundayStart,
} from "./weeklyAdsComparison.ts";

const record = (
  date: string,
  campaign: string,
  spend: number,
  leads: number,
  source = "facebook_insights",
) => ({
  _source: source,
  data: {
    date,
    campaign_id: campaign,
    campaign_name: campaign,
    entity_level: "campaign",
    spend,
    leads,
    impressions: 1000,
    clicks: 50,
  },
});

test("groups campaign records into Sunday–Saturday weeks, newest first", () => {
  const sections = buildWeeklyCampaignSections([
    record("2026-09-13", "A", 100, 5),
    record("2026-09-18", "A", 50, 5),
    record("2026-09-12", "A", 80, 4),
    record("2026-09-06", "B", 40, 2),
  ], { now: new Date("2026-09-18T12:00:00Z") });

  assert.deepEqual(sections.map((week) => [week.startDate, week.endDate]), [
    ["2026-09-13", "2026-09-19"],
    ["2026-09-06", "2026-09-12"],
  ]);
  assert.equal(sections[0].rows[0].spend, 150);
  assert.equal(sections[0].rows[0].results, 10);
  assert.equal(sections[0].rows[0].costPerResult, 15);
  assert.equal(sections[1].rows.length, 2);
});

test("excludes ad-set and ad rows so campaign totals are not tripled", () => {
  const base = record("2026-09-14", "A", 100, 5);
  const sections = buildWeeklyCampaignSections([
    base,
    { ...base, data: { ...base.data, entity_level: "adset" } },
    { ...base, data: { ...base.data, entity_level: "ad" } },
  ], { now: new Date("2026-09-18T12:00:00Z") });

  assert.equal(sections[0].totals.spend, 100);
  assert.equal(sections[0].totals.results, 5);
});

test("separates same-named campaigns from different platforms", () => {
  const sections = buildWeeklyCampaignSections([
    record("2026-09-14", "Brand", 100, 5, "facebook_insights"),
    record("2026-09-14", "Brand", 200, 10, "google_ads"),
  ], { now: new Date("2026-09-18T12:00:00Z") });

  assert.equal(sections[0].rows.length, 2);
  assert.deepEqual(sections[0].rows.map((row) => row.source).sort(), [
    "facebook_insights",
    "google_ads",
  ]);
});

test("uses purchases and ROAS for ecommerce campaigns", () => {
  const sections = buildWeeklyCampaignSections([{
    _source: "facebook_ecommerce",
    data: {
      date: "2026-09-14",
      campaign_id: "shop",
      campaign_name: "Shop",
      spend: 200,
      purchases: 4,
      purchase_value: 1000,
    },
  }], { now: new Date("2026-09-18T12:00:00Z") });

  assert.equal(sections[0].rows[0].kind, "ecommerce");
  assert.equal(sections[0].rows[0].results, 4);
  assert.equal(sections[0].rows[0].costPerResult, 50);
  assert.equal(sections[0].rows[0].roas, 5);
});

test("limits the comparison to the requested number of weeks", () => {
  const sections = buildWeeklyCampaignSections([
    record("2026-09-14", "current", 100, 5),
    record("2025-09-15", "old", 100, 5),
  ], { now: new Date("2026-09-18T12:00:00Z"), maxWeeks: 52 });

  assert.deepEqual(sections.map((week) => week.rows[0].campaign), ["current"]);
});

test("week and heading formatting are timezone-independent", () => {
  assert.equal(getSundayStart(new Date("2026-09-18T23:59:00Z")).toISOString(), "2026-09-13T00:00:00.000Z");
  assert.equal(formatWeeklyRange("2026-09-13", "2026-09-19"), "13/09/2026–19/09/2026");
});
