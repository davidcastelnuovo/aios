import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateFacebookReportConnect,
  evaluateGoogleAdsReportConnect,
  normalizeMetaAdAccountId,
} from "./facebook-connect-guards.ts";

test("normalizeMetaAdAccountId strips act_ and non-digits", () => {
  assert.equal(normalizeMetaAdAccountId("act_1234567890"), "1234567890");
  assert.equal(normalizeMetaAdAccountId("1234567890"), "1234567890");
  assert.equal(normalizeMetaAdAccountId(""), null);
  assert.equal(normalizeMetaAdAccountId(null), null);
});

test("evaluateFacebookReportConnect refuses non-ppc_meta clients", () => {
  const result = evaluateFacebookReportConnect(
    { services: ["seo"], meta_ads_account_id: "111" },
    "111",
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "service_not_ppc_meta");
});

test("evaluateFacebookReportConnect refuses missing stored account id", () => {
  const result = evaluateFacebookReportConnect(
    { services: ["ppc_meta"], meta_ads_account_id: null },
    "act_111",
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "missing_meta_ads_account_id");
});

test("evaluateFacebookReportConnect refuses fuzzy mismatch", () => {
  const result = evaluateFacebookReportConnect(
    { services: ["ppc_meta"], meta_ads_account_id: "111" },
    "act_999",
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "ad_account_mismatch");
});

test("evaluateFacebookReportConnect accepts matching stored id", () => {
  const result = evaluateFacebookReportConnect(
    { services: ["ppc_meta", "seo"], meta_ads_account_id: "act_123" },
    "123",
  );
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.normalized_ad_account_id, "123");
});

test("evaluateGoogleAdsReportConnect mirrors the same data rules", () => {
  assert.equal(
    evaluateGoogleAdsReportConnect({ services: ["seo"], google_ads_account_id: "1" }, "1").ok,
    false,
  );
  assert.equal(
    evaluateGoogleAdsReportConnect({ services: ["ppc_google"], google_ads_account_id: null }, "1").ok,
    false,
  );
  const ok = evaluateGoogleAdsReportConnect(
    { services: ["ppc_google"], google_ads_account_id: "123-456-7890" },
    "1234567890",
  );
  assert.equal(ok.ok, true);
});
