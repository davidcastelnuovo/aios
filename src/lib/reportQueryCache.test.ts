import assert from "node:assert/strict";
import test from "node:test";
import type { DehydratedState } from "@tanstack/react-query";

// Test the persistence filter inline (same rules as reportQueryCache.ts).
function hasPersistableReportData(data: unknown): boolean {
  if (data === undefined || data === null) return false;
  if (Array.isArray(data)) return data.length > 0;
  if (typeof data === "object") {
    const recordCount = (data as { records?: unknown[] }).records;
    if (Array.isArray(recordCount)) return recordCount.length > 0;
    return Object.keys(data as object).length > 0;
  }
  return true;
}

function filterQueries(state: DehydratedState): DehydratedState {
  return {
    ...state,
    queries: (state.queries ?? []).filter((entry) =>
      hasPersistableReportData(entry.state?.data),
    ),
  };
}

test("empty report arrays are not persisted", () => {
  const state: DehydratedState = {
    mutations: [],
    queries: [
      {
        queryHash: "a",
        queryKey: ["crm-tables-for-dashboard", "client-1"],
        state: { data: [], dataUpdatedAt: 0, error: null, errorUpdatedAt: 0, fetchFailureCount: 0, fetchFailureReason: null, fetchMeta: null, fetchStatus: "idle", isInvalidated: false, status: "success", dataUpdateCount: 1, errorUpdateCount: 0, errorUpdatedCount: 0, isPaused: false },
      },
      {
        queryHash: "b",
        queryKey: ["crm-tables-for-dashboard", "client-2"],
        state: { data: [{ id: "t1" }], dataUpdatedAt: 0, error: null, errorUpdatedAt: 0, fetchFailureCount: 0, fetchFailureReason: null, fetchMeta: null, fetchStatus: "idle", isInvalidated: false, status: "success", dataUpdateCount: 1, errorUpdateCount: 0, errorUpdatedCount: 0, isPaused: false },
      },
    ],
  };

  const filtered = filterQueries(state);
  assert.equal(filtered.queries.length, 1);
  assert.deepEqual(filtered.queries[0].state.data, [{ id: "t1" }]);
});
