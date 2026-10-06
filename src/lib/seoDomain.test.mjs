import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSeoReportTenantIds,
  extractDomainHint,
  looksLikeSeoDomain,
  pickSeoSyncDomain,
  resolveLinkedCrmTableId,
  resolveSeoLinkedGscSiteUrl,
  selectSeoTableForClient,
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

test("pickSeoSyncDomain prefers linkedGscSiteUrl and ahrefs_reports over empty client", () => {
  const fromGsc = pickSeoSyncDomain({
    settings: { linkedGscSiteUrl: "https://www.manltd.co.il/" },
    client: { website: null, ahrefs_domain: null },
    tableName: "מן מכונות ניקוי",
  });
  assert.equal(fromGsc.domain, "manltd.co.il");
  assert.equal(fromGsc.from, "linkedGscSiteUrl");

  const fromReport = pickSeoSyncDomain({
    settings: {},
    client: { website: null, ahrefs_domain: null },
    latestReportDomain: "manltd.co.il",
  });
  assert.equal(fromReport.domain, "manltd.co.il");
  assert.equal(fromReport.from, "ahrefs_reports");
});

test("resolveLinkedCrmTableId ignores stale saved ids", () => {
  const candidates = [
    { id: "ga-live", client_id: "client-1" },
  ];
  assert.equal(resolveLinkedCrmTableId("ga-deleted", candidates, "client-1"), "ga-live");
  assert.equal(resolveLinkedCrmTableId("ga-live", candidates, "client-1"), "ga-live");
});

test("selectSeoTableForClient prefers domain match over null-domain duplicate", () => {
  const picked = selectSeoTableForClient(
    [
      {
        id: "dup",
        client_id: "client-1",
        integration_settings: { targetDomain: null },
        updated_at: "2026-09-01T00:00:00Z",
      },
      {
        id: "good",
        client_id: "client-1",
        integration_settings: { targetDomain: "franchise.org.il" },
        updated_at: "2026-08-01T00:00:00Z",
      },
    ],
    "client-1",
    "https://franchise.org.il",
  );
  assert.equal(picked?.id, "good");
});

test("resolveSeoLinkedGscSiteUrl prefers linkedGscSiteUrl and falls back to legacy gsc_site_url", () => {
  assert.equal(
    resolveSeoLinkedGscSiteUrl({
      integrationSettings: {
        linkedGscSiteUrl: "sc-domain:franchise.org.il",
        gsc_site_url: "https://other.example/",
      },
      expectedDomain: "franchise.org.il",
    }),
    "sc-domain:franchise.org.il",
  );

  assert.equal(
    resolveSeoLinkedGscSiteUrl({
      integrationSettings: { gsc_site_url: "sc-domain:franchise.org.il" },
      clientGscSiteUrl: "https://franchise.org.il/",
      expectedDomain: "franchise.org.il",
    }),
    "sc-domain:franchise.org.il",
  );

  assert.equal(
    resolveSeoLinkedGscSiteUrl({
      integrationSettings: {},
      clientGscSiteUrl: "https://franchise.org.il/",
      expectedDomain: "franchise.org.il",
    }),
    "https://franchise.org.il/",
  );

  assert.equal(
    resolveSeoLinkedGscSiteUrl({
      integrationSettings: { gsc_site_url: "https://other.example/" },
      expectedDomain: "franchise.org.il",
    }),
    "",
  );
});

test("seoTableNeedsSyncThisMonth is true when last sync is before current month", () => {
  const lastMonth = new Date();
  lastMonth.setUTCMonth(lastMonth.getUTCMonth() - 1);
  assert.equal(seoTableNeedsSyncThisMonth(lastMonth.toISOString()), true);
  assert.equal(seoTableNeedsSyncThisMonth(null), true);
  assert.equal(seoTableNeedsSyncThisMonth(new Date().toISOString()), false);
});
