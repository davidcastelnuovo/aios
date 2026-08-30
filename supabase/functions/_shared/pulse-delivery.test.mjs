import assert from "node:assert/strict";
import test from "node:test";

import { buildPulseWhatsAppDigest } from "./campaign-pulse.ts";
import {
  buildPulsePreviewMessage,
  mergePulseDeliveryPlans,
  planCampaignerPulseDeliveries,
  planTeamManagerPulseDeliveries,
  scopeSnapshotsForPlan,
} from "./pulse-delivery.ts";

const SNAPSHOTS = [
  { client_id: "c1", agency_id: "a1", client_name: "Alpha", status: "healthy" },
  { client_id: "c2", agency_id: "a1", client_name: "Beta", status: "warning" },
  { client_id: "c3", agency_id: "a2", client_name: "Gamma", status: "critical" },
];

test("planCampaignerPulseDeliveries scopes to client_team with pulse rows only", () => {
  const plans = planCampaignerPulseDeliveries(
    SNAPSHOTS,
    [
      { campaigner_id: "cam1", client_id: "c1" },
      { campaigner_id: "cam1", client_id: "c2" },
      { campaigner_id: "cam2", client_id: "c3" },
      { campaigner_id: "cam2", client_id: "missing" },
    ],
    [
      { id: "cam1", full_name: "אביעד", phone: "972549757611" },
      { id: "cam2", full_name: "דנה", phone: "0501234567" },
      { id: "cam3", full_name: "ללא לקוחות", phone: "972521111111" },
    ],
  );
  assert.equal(plans.length, 2);
  assert.deepEqual(plans.find((p) => p.key === "campaigner:cam1")?.clientIds.sort(), ["c1", "c2"]);
  assert.deepEqual(plans.find((p) => p.key === "campaigner:cam2")?.clientIds, ["c3"]);
});

test("planTeamManagerPulseDeliveries scopes by managed agencies", () => {
  const plans = planTeamManagerPulseDeliveries(SNAPSHOTS, [
    {
      user_id: "u1",
      full_name: "פליקס",
      phone: "972558833168",
      agency_ids: ["a1"],
    },
    {
      user_id: "u2",
      full_name: "מנהל ריק",
      phone: "972500000000",
      agency_ids: ["a9"],
    },
  ]);
  assert.equal(plans.length, 1);
  assert.equal(plans[0].name, "פליקס");
  assert.deepEqual(plans[0].clientIds.sort(), ["c1", "c2"]);
});

test("mergePulseDeliveryPlans unions client ids for same phone", () => {
  const merged = mergePulseDeliveryPlans([
    {
      key: "campaigner:x",
      role: "campaigner",
      name: "אביעד",
      phone: "972549757611",
      clientIds: ["c1"],
    },
    {
      key: "manager:y",
      role: "team_manager",
      name: "אביעד מנהל",
      phone: "0549757611",
      clientIds: ["c2"],
    },
  ]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].role, "team_manager");
  assert.deepEqual(merged[0].clientIds.sort(), ["c1", "c2"]);
});

test("planTeamManagerPulseDeliveries skips excluded recipients", () => {
  const plans = planTeamManagerPulseDeliveries(SNAPSHOTS, [
    {
      user_id: "u1",
      full_name: "אילנית",
      phone: "972500000001",
      agency_ids: ["a1"],
    },
    {
      user_id: "u2",
      full_name: "פליקס",
      phone: "972558833168",
      agency_ids: ["a1"],
    },
  ]);
  assert.equal(plans.length, 1);
  assert.equal(plans[0].name, "פליקס");
});

test("planCampaignerPulseDeliveries skips excluded owner phone", () => {
  const plans = planCampaignerPulseDeliveries(
    SNAPSHOTS,
    [{ campaigner_id: "cam-owner", client_id: "c1" }],
    [{ id: "cam-owner", full_name: "דוד", phone: "972507677613" }],
  );
  assert.equal(plans.length, 0);
});

test("preview message wraps scoped digest for campaigner", () => {
  const scoped = scopeSnapshotsForPlan(SNAPSHOTS, {
    key: "campaigner:cam1",
    role: "campaigner",
    name: "אביעד",
    phone: "972549757611",
    clientIds: ["c1", "c2"],
  });
  const digest = buildPulseWhatsAppDigest(scoped, "https://aios.co.il/t/dmm/dmm-dashboard");
  const preview = buildPulsePreviewMessage("אביעד", digest);
  assert.match(preview, /תצוגה מקדימה — בדיקת דופק לאביעד/);
  assert.match(preview, /נבדקו 2 יעדי קמפיין/);
  assert.match(preview, /https:\/\/aios\.co\.il\/t\/dmm\/dmm-dashboard/);
});
