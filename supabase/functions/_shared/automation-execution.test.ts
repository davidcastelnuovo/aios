import assert from "node:assert/strict";
import test from "node:test";
import {
  exceedsRunBudget,
  isClaimLeaseExpired,
  isDuplicateClaimError,
  MESSAGE_CLAIM_LEASE_MS,
  summarizeExecution,
  WHATSAPP_RUN_BUDGET,
} from "./automation-execution.ts";

test("all automations succeeded → completed", () => {
  const summary = summarizeExecution([
    { status: "fulfilled", value: { success: true, automation_id: "a" } },
    { status: "fulfilled", value: { success: true, automation_id: "b" } },
  ]);
  assert.deepEqual(summary, {
    status: "completed",
    actions_count: 2,
    error: null,
  });
});

test("skipped automation (conditions not met) is not a failure", () => {
  const summary = summarizeExecution([
    { status: "fulfilled", value: { success: false, skipped: true } },
  ]);
  assert.equal(summary.status, "completed");
  assert.equal(summary.error, null);
});

test("a failing automation marks the run failed with its error", () => {
  const summary = summarizeExecution([
    { status: "fulfilled", value: { success: true } },
    {
      status: "fulfilled",
      value: { success: false, automation_id: "b", error: "send failed" },
    },
  ]);
  assert.equal(summary.status, "failed");
  assert.equal(summary.error, "send failed");
  assert.equal(summary.actions_count, 2);
});

test("success:false without an error message is still a failure", () => {
  const summary = summarizeExecution([
    { status: "fulfilled", value: { success: false, automation_id: "c" } },
    { status: "fulfilled", value: undefined }, // conditions not met
  ]);
  assert.equal(summary.status, "failed");
  assert.equal(summary.error, "automation reported failure");
});

test("a thrown automation marks the run failed", () => {
  const summary = summarizeExecution([
    { status: "rejected", reason: new Error("boom") },
  ]);
  assert.equal(summary.status, "failed");
  assert.equal(summary.error, "boom");
});

test("no matching automations → completed with zero actions", () => {
  assert.deepEqual(summarizeExecution([]), {
    status: "completed",
    actions_count: 0,
    error: null,
  });
});

test("only unique_violation counts as a duplicate claim", () => {
  assert.equal(isDuplicateClaimError({ code: "23505" }), true);
  assert.equal(isDuplicateClaimError({ code: "42P01" }), false);
  assert.equal(isDuplicateClaimError(null), false);
  assert.equal(isDuplicateClaimError(undefined), false);
});

test("skipped and conditions-not-met automations are not counted as run", () => {
  const summary = summarizeExecution([
    { status: "fulfilled", value: undefined },
    { status: "fulfilled", value: { skipped: true, reason: "mismatch" } },
  ]);
  assert.deepEqual(summary, {
    status: "completed",
    actions_count: 0,
    error: null,
  });
});

test("actions_count counts only automations that ran", () => {
  const summary = summarizeExecution([
    { status: "fulfilled", value: undefined },
    { status: "fulfilled", value: { success: true } },
    { status: "rejected", reason: new Error("boom") },
  ]);
  assert.equal(summary.actions_count, 2);
  assert.equal(summary.status, "failed");
});

test("completed claims never expire", () => {
  assert.equal(
    isClaimLeaseExpired(
      {
        processed_at: "2026-10-24T00:00:00Z",
        completed_at: "2026-10-24T00:00:05Z",
      },
      Date.parse("2026-10-24T10:00:00Z"),
    ),
    false,
  );
});

test("an unfinished claim is taken over only after the lease", () => {
  const claim = { processed_at: "2026-10-24T10:00:00Z", completed_at: null };
  const start = Date.parse(claim.processed_at);
  assert.equal(isClaimLeaseExpired(claim, start + 60_000), false);
  assert.equal(
    isClaimLeaseExpired(claim, start + MESSAGE_CLAIM_LEASE_MS),
    true,
  );
});

test("run budget allows normal traffic and stops a burst", () => {
  assert.equal(exceedsRunBudget(0), false);
  assert.equal(exceedsRunBudget(WHATSAPP_RUN_BUDGET.maxRuns - 1), false);
  assert.equal(exceedsRunBudget(WHATSAPP_RUN_BUDGET.maxRuns), true);
});
