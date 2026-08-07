import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSeoReportTenantIds,
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

test("seoTableNeedsSyncThisMonth is true when last sync is before current month", () => {
  const lastMonth = new Date();
  lastMonth.setUTCMonth(lastMonth.getUTCMonth() - 1);
  assert.equal(seoTableNeedsSyncThisMonth(lastMonth.toISOString()), true);
  assert.equal(seoTableNeedsSyncThisMonth(null), true);
  assert.equal(seoTableNeedsSyncThisMonth(new Date().toISOString()), false);
});
