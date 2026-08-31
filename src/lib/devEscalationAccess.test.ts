import assert from "node:assert/strict";
import test from "node:test";
import { canDispatchDevTask, getDevEscalationTier } from "./devEscalationAccess.ts";

test("David user id gets full tier", () => {
  assert.equal(
    getDevEscalationTier({ userId: "ac7b2493-dcfa-47d8-80cc-b3900a406c46" }),
    "full",
  );
  assert.equal(canDispatchDevTask("full"), true);
});

test("unknown user cannot dispatch dev tasks", () => {
  assert.equal(getDevEscalationTier({ userId: "00000000-0000-0000-0000-000000000000" }), null);
  assert.equal(canDispatchDevTask(null), false);
});
