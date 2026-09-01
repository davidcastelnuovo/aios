import assert from "node:assert/strict";
import test from "node:test";

import {
  extractAccountIdFromReportTable,
  metaAdAccountsEqual,
  normalizeGoogleCustomerId,
  normalizeMetaAdAccountId,
  parseMetaAdAccountIdInput,
  validateMetaAdPlatform,
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

test("parseMetaAdAccountIdInput accepts act_ prefix and digits", () => {
  const withPrefix = parseMetaAdAccountIdInput("act_561430705400571");
  assert.equal(withPrefix.ok, true);
  assert.equal(withPrefix.accountId, "act_561430705400571");

  const digitsOnly = parseMetaAdAccountIdInput("561430705400571");
  assert.equal(digitsOnly.ok, true);
  assert.equal(digitsOnly.accountId, "act_561430705400571");
});

test("parseMetaAdAccountIdInput rejects invalid ids", () => {
  assert.equal(parseMetaAdAccountIdInput("").ok, false);
  assert.equal(parseMetaAdAccountIdInput("act_abc").ok, false);
});

test("metaAdAccountsEqual compares normalized ids", () => {
  assert.equal(metaAdAccountsEqual("561430705400571", "act_561430705400571"), true);
  assert.equal(metaAdAccountsEqual("act_111", "act_222"), false);
});

test("validateMetaAdPlatform accepts facebook/meta aliases", () => {
  assert.equal(validateMetaAdPlatform("meta").ok, true);
  assert.equal(validateMetaAdPlatform("tiktok").ok, false);
});
