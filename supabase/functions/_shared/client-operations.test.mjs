import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { deriveClientRecommendationDrafts } from "./client-operations.ts";

describe("deriveClientRecommendationDrafts", () => {
  const now = Date.parse("2026-09-22T12:00:00Z");

  it("creates critical alert recommendation", () => {
    const drafts = deriveClientRecommendationDrafts({
      clientId: "c1",
      clientName: "Binat",
      pulse: null,
      openAlerts: [{ id: "a1", alert_type: "campaign_stopped", severity: "critical" }],
      nowMs: now,
    });
    assert.equal(drafts.some((d) => d.recommendation_type === "handle_critical_alert"), true);
  });

  it("flags stale client call when pulse active", () => {
    const drafts = deriveClientRecommendationDrafts({
      clientId: "c1",
      clientName: "Test",
      pulse: {
        status: "warning",
        last_client_call_at: "2026-08-01T00:00:00Z",
      },
      openAlerts: [],
      nowMs: now,
    });
    assert.equal(drafts.some((d) => d.recommendation_type === "contact_client"), true);
  });

  it("dedup fingerprint stable for stale call", () => {
    const d = deriveClientRecommendationDrafts({
      clientId: "c1",
      clientName: "Test",
      pulse: { status: "healthy", last_client_call_at: null },
      openAlerts: [],
      nowMs: now,
    }).find((x) => x.recommendation_type === "contact_client");
    assert.equal(d?.fingerprint, "stale_client_call:14d");
  });
});
