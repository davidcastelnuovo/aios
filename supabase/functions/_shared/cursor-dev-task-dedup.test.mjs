import assert from "node:assert/strict";
import test from "node:test";
import { formatInFlightDuplicateError } from "./cursor-dev-task-dedup.ts";
import { titleSimilarity } from "./dev-tasks.ts";

test("titleSimilarity catches Ana end-date bug variants above threshold", () => {
  const a = "Requested by Ana — BUG FIX ONLY: Fix inability to clear/remove a client's work end date in the CRM client edit flow.";
  const b = "Requested by Ana — BUG FIX ONLY: Client edit form does not allow clearing/removing an existing end-of-work date.";
  assert.ok(titleSimilarity(a, b) >= 0.5);
});

test("formatInFlightDuplicateError includes block marker and session url", () => {
  const msg = formatInFlightDuplicateError([{
    source: "dev_task",
    id: "abc-123",
    title: "Fix client end date clear",
    score: 0.62,
    status: "sent_to_cursor",
    session_url: "https://cursor.com/agents/bc-test",
    cursor_agent_id: "bc-test",
  }]);
  assert.match(msg, /DUPLICATE_DEV_TASK_BLOCKED/);
  assert.match(msg, /bc-test/);
});
