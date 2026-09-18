import assert from "node:assert/strict";
import test from "node:test";
import { getClientMoodChanges, normalizeClientMoodStatus } from "./clientMoodHistory.ts";

test("normalizes legacy communication statuses to client mood statuses", () => {
  assert.equal(normalizeClientMoodStatus("normal"), "happy");
  assert.equal(normalizeClientMoodStatus("sensitive"), "wavering");
  assert.equal(normalizeClientMoodStatus("complaint"), "churn_risk");
  assert.equal(normalizeClientMoodStatus("not_progressing"), "not_progressing");
  assert.equal(normalizeClientMoodStatus("unknown"), null);
});

test("returns only real mood transitions in newest-first order", () => {
  const changes = getClientMoodChanges([
    { id: "3", status: "wavering", created_at: "2026-09-03T10:00:00Z" },
    { id: "1", status: "normal", created_at: "2026-09-01T10:00:00Z" },
    { id: "4", status: "sensitive", created_at: "2026-09-04T10:00:00Z" },
    { id: "2", status: "happy", created_at: "2026-09-02T10:00:00Z" },
  ]);

  assert.deepEqual(
    changes.map(({ id, moodStatus, previousMoodStatus }) => ({
      id,
      moodStatus,
      previousMoodStatus,
    })),
    [
      { id: "3", moodStatus: "wavering", previousMoodStatus: "happy" },
      { id: "1", moodStatus: "happy", previousMoodStatus: null },
    ],
  );
});
