import assert from "node:assert/strict";
import test from "node:test";

import {
  isLastVisibleSharedReportTab,
  isSharedReportTabVisible,
  parseSharedReportTabs,
  withSharedReportTab,
} from "./sharedReportTabs.ts";

test("share links with no saved preference show every tab", () => {
  assert.deepEqual(parseSharedReportTabs(null), {
    seo: true,
    gsc: true,
    ga: true,
    maskyoo: true,
    monthly_work: true,
  });
  assert.deepEqual(parseSharedReportTabs({ targetDomain: "example.com" }), {
    seo: true,
    gsc: true,
    ga: true,
    maskyoo: true,
    monthly_work: true,
  });
});

test("a hidden tab stays hidden and the rest stay visible", () => {
  const visibility = parseSharedReportTabs({ shared_tabs: { maskyoo: false } });
  assert.equal(visibility.maskyoo, false);
  assert.equal(visibility.seo, true);
  assert.equal(visibility.monthly_work, true);
  assert.equal(isSharedReportTabVisible({ shared_tabs: { maskyoo: false } }, "maskyoo"), false);
});

test("legacy and string-ish values are understood", () => {
  const visibility = parseSharedReportTabs({
    sharedTabs: { "monthly-work": false, searchconsole: "false", ga: 1 },
  });
  assert.equal(visibility.monthly_work, false);
  assert.equal(visibility.gsc, false);
  assert.equal(visibility.ga, true);
});

test("hiding every tab still leaves the SEO tab", () => {
  const visibility = parseSharedReportTabs({
    shared_tabs: { seo: false, gsc: false, ga: false, maskyoo: false, monthly_work: false },
  });
  assert.equal(visibility.seo, true);
});

test("malformed stored values are ignored", () => {
  assert.equal(parseSharedReportTabs({ shared_tabs: ["maskyoo"] }).maskyoo, true);
  assert.equal(parseSharedReportTabs({ shared_tabs: "maskyoo" }).maskyoo, true);
  assert.equal(parseSharedReportTabs({ shared_tabs: { unknown_tab: false } }).seo, true);
});

test("toggling one tab keeps the other integration settings", () => {
  const next = withSharedReportTab(
    { targetDomain: "example.com", shared_tabs: { ga: false } },
    "maskyoo",
    false,
  );
  assert.equal(next.targetDomain, "example.com");
  assert.deepEqual(next.shared_tabs, {
    seo: true,
    gsc: true,
    ga: false,
    maskyoo: false,
    monthly_work: true,
  });
});

test("the last visible tab is flagged so the UI can block hiding it", () => {
  const onlySeo = parseSharedReportTabs({
    shared_tabs: { gsc: false, ga: false, maskyoo: false, monthly_work: false },
  });
  assert.equal(isLastVisibleSharedReportTab(onlySeo, "seo"), true);
  assert.equal(isLastVisibleSharedReportTab(onlySeo, "maskyoo"), false);
  assert.equal(isLastVisibleSharedReportTab(parseSharedReportTabs(null), "seo"), false);
});
