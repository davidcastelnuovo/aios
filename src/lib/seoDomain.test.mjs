import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSeoReportTenantIds,
  extractDomainHint,
  looksLikeSeoDomain,
  seoTableNeedsSyncThisMonth,
} from "./seoDomain.ts";

test("buildSeoReportTenantIds includes client home + agency access + table tenant", () => {
  const ids = buildSeoReportTenantIds(
    { tenant_id: "home", agency_id: "a1" },
    [
      { accessing_tenant_id: "mc", source_tenant_id: "dmm" },
    ],
    ["table-tenant"],
  );
  assert.deepEqual(ids.sort(), ["dmm", "home", "mc", "table-tenant"].sort());
});

test("extractDomainHint finds hostnames in table titles", () => {
  assert.equal(extractDomainHint("ג.ג - אנגלית - gg-ds.com"), "gg-ds.com");
  assert.equal(extractDomainHint("YTS"), "");
});

test("looksLikeSeoDomain rejects Hebrew client names stored as targetDomain", () => {
  assert.equal(looksLikeSeoDomain("ג.ג - אנגלית - gg-ds.com"), false);
  assert.equal(looksLikeSeoDomain("gg-ds.com"), true);
});

test("seoTableNeedsSyncThisMonth is true when last sync is before current month", () => {
  const lastMonth = new Date();
  lastMonth.setUTCMonth(lastMonth.getUTCMonth() - 1);
  assert.equal(seoTableNeedsSyncThisMonth(lastMonth.toISOString()), true);
  assert.equal(seoTableNeedsSyncThisMonth(null), true);
  assert.equal(seoTableNeedsSyncThisMonth(new Date().toISOString()), false);
});
