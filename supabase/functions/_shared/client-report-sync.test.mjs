import assert from "node:assert/strict";
import test from "node:test";

import {
  extractAccountIdFromReportTable,
  normalizeGoogleCustomerId,
  normalizeMetaAdAccountId,
  validateReportTableAccountId,
} from "./client-report-sync.mjs";

test("normalizeGoogleCustomerId strips dashes", () => {
  assert.equal(normalizeGoogleCustomerId("538-568-6491"), "5385686491");
  assert.equal(normalizeGoogleCustomerId("5385686491"), "5385686491");
  assert.equal(normalizeGoogleCustomerId(""), null);
});

test("normalizeMetaAdAccountId ensures act_ prefix", () => {
  assert.equal(normalizeMetaAdAccountId("651825899520164"), "act_651825899520164");
  assert.equal(normalizeMetaAdAccountId("act_651825899520164"), "act_651825899520164");
});

test("extractAccountIdFromReportTable reads google_ads customer_id", () => {
  assert.equal(
    extractAccountIdFromReportTable("google_ads", { customer_id: "538-568-6491" }),
    "5385686491",
  );
});

test("extractAccountIdFromReportTable reads facebook ad_account_id", () => {
  assert.equal(
    extractAccountIdFromReportTable("facebook_insights", { ad_account_id: "act_651825899520164" }),
    "act_651825899520164",
  );
});

test("validateReportTableAccountId flags missing google account", () => {
  const v = validateReportTableAccountId("google_ads", {}, { clientId: "c1", tableId: "t1" });
  assert.equal(v.ok, false);
  assert.equal(v.reason, "missing_account_id");
});

test("validateReportTableAccountId passes with account id", () => {
  const v = validateReportTableAccountId("google_ads", { customer_id: "123" });
  assert.equal(v.ok, true);
  assert.equal(v.accountId, "123");
});
