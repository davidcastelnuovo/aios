import assert from "node:assert/strict";
import test from "node:test";
import { pickTranscriptRow, resolveSummaryTarget } from "./recordingSummaryTarget.ts";

test("an explicit summary scope wins over other associations", () => {
  assert.deepEqual(
    resolveSummaryTarget({
      id: "rec-1",
      summary_scope: "campaigner",
      client_id: "client-1",
      campaigner_ids: ["camp-1"],
      agency_id: "agency-1",
    }),
    { target_type: "campaigner", target_id: "camp-1" },
  );

  assert.deepEqual(
    resolveSummaryTarget({
      id: "rec-2",
      summary_scope: "agency",
      agency_id: "agency-1",
      client_id: "client-1",
    }),
    { target_type: "agency", target_id: "agency-1" },
  );
});

test("without a scope the client, lead, campaigner, agency order is preserved", () => {
  assert.deepEqual(
    resolveSummaryTarget({ id: "rec-3", client_id: "client-1", agency_id: "agency-1" }),
    { target_type: "client", target_id: "client-1" },
  );
  assert.deepEqual(
    resolveSummaryTarget({ id: "rec-4", lead_id: "lead-1", agency_id: "agency-1" }),
    { target_type: "lead", target_id: "lead-1" },
  );
  assert.deepEqual(
    resolveSummaryTarget({ id: "rec-5", campaigner_ids: ["camp-1"], agency_id: "agency-1" }),
    { target_type: "campaigner", target_id: "camp-1" },
  );
  assert.deepEqual(
    resolveSummaryTarget({ id: "rec-6", agency_id: "agency-1" }),
    { target_type: "agency", target_id: "agency-1" },
  );
});

test("an unassigned recording falls back to the tenant agency, otherwise null", () => {
  assert.deepEqual(
    resolveSummaryTarget({ id: "rec-7", campaigner_ids: [] }, "agency-default"),
    { target_type: "agency", target_id: "agency-default" },
  );
  assert.equal(resolveSummaryTarget({ id: "rec-8" }), null);
  assert.equal(resolveSummaryTarget({ id: "rec-9", summary_scope: "client" }, null), null);
});

test("a stale scope never overrides the association that actually exists", () => {
  assert.deepEqual(
    resolveSummaryTarget({ id: "rec-10", summary_scope: "client", agency_id: "agency-1" }),
    { target_type: "agency", target_id: "agency-1" },
  );
});

test("the longest transcript in a grouped meeting is used as the source", () => {
  const rows = [
    { id: "rec-audio", transcription: "   " },
    { id: "rec-video", transcription: "תמלול ארוך יותר של הפגישה" },
    { id: "rec-screen", transcription: "קצר" },
  ];

  assert.equal(pickTranscriptRow(rows)?.id, "rec-video");
  assert.equal(pickTranscriptRow([{ id: "rec-empty", transcription: null }]), null);
  assert.equal(pickTranscriptRow([]), null);
});
