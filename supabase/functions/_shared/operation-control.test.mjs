import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  devDispatchIdempotencyKey,
  mapDevDispatchToRunFields,
} from "./operation-control.ts";

describe("operation-control", () => {
  it("devDispatchIdempotencyKey is stable", () => {
    assert.equal(
      devDispatchIdempotencyKey("t1", "d1"),
      "t1:dev_task:d1",
    );
  });

  it("mapDevDispatchToRunFields — delivered", () => {
    const m = mapDevDispatchToRunFields({
      tenantId: "t",
      devTaskId: "d",
      taskTitle: "x",
      delivered: true,
    });
    assert.equal(m.status, "executed");
    assert.equal(m.rollup_status, "on_track");
    assert.equal(m.verification_status, "passed");
  });

  it("mapDevDispatchToRunFields — reconciled", () => {
    const m = mapDevDispatchToRunFields({
      tenantId: "t",
      devTaskId: "d",
      taskTitle: "x",
      delivered: true,
      reconciled: true,
    });
    assert.equal(m.status, "verified");
    assert.equal(m.summary.includes("reconcile"), true);
  });

  it("mapDevDispatchToRunFields — verification failed", () => {
    const m = mapDevDispatchToRunFields({
      tenantId: "t",
      devTaskId: "d",
      taskTitle: "x",
      delivered: false,
      verificationFailed: true,
    });
    assert.equal(m.status, "exception");
    assert.equal(m.rollup_status, "needs_attention");
    assert.equal(m.exception_count, 1);
  });
});
