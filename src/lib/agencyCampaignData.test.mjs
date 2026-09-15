import test from "node:test";
import assert from "node:assert/strict";
import { buildClientCampaignTableData } from "./agencyCampaignData.ts";

test("buildClientCampaignTableData aggregates campaigns per client table", () => {
  const rows = buildClientCampaignTableData({
    clients: [{ id: "c1", name: "Client A" }],
    tables: [
      {
        id: "t1",
        client_id: "c1",
        name: "FB",
        integration_type: "facebook_insights",
        integration_settings: null,
      },
    ],
    records: [
      {
        table_id: "t1",
        data: {
          date: "2026-09-10",
          campaign_name: "Lead Gen",
          impressions: 100,
          clicks: 10,
          leads: 2,
          spend: 50,
        },
      },
      {
        table_id: "t1",
        data: {
          date: "2026-09-11",
          campaign_name: "Lead Gen",
          impressions: 50,
          clicks: 5,
          leads: 1,
          spend: 25,
        },
      },
    ],
    startDate: "2026-09-01",
    endDate: "2026-09-15",
    platformFilter: "all",
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].records.length, 1);
  assert.equal(rows[0].totals.leads, 3);
  assert.equal(rows[0].totals.spend, 75);
});

test("buildClientCampaignTableData respects platform filter", () => {
  const rows = buildClientCampaignTableData({
    clients: [{ id: "c1", name: "Client A" }],
    tables: [
      { id: "t1", client_id: "c1", integration_type: "facebook_insights" },
      { id: "t2", client_id: "c1", integration_type: "google_ads" },
    ],
    records: [
      { table_id: "t1", data: { date: "2026-09-10", campaign_name: "FB", spend: 10, leads: 1 } },
      { table_id: "t2", data: { date: "2026-09-10", campaign_name: "GA", spend: 20, leads: 2 } },
    ],
    startDate: "2026-09-01",
    endDate: "2026-09-15",
    platformFilter: "google_ads",
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].integrationType, "google_ads");
  assert.equal(rows[0].totals.spend, 20);
});
