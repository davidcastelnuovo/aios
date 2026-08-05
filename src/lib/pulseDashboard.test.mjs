import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPulseDashboardUrl,
  clientHasCampaignService,
  formatPulseChange,
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
