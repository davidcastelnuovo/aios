import assert from "node:assert/strict";
import test from "node:test";

import { asUuidOrNull } from "./uuid.mjs";

test("asUuidOrNull returns null for system / empty / invalid", () => {
  assert.equal(asUuidOrNull("system"), null);
  assert.equal(asUuidOrNull("SYSTEM"), null);
  assert.equal(asUuidOrNull(""), null);
  assert.equal(asUuidOrNull("   "), null);
  assert.equal(asUuidOrNull(null), null);
  assert.equal(asUuidOrNull(undefined), null);
  assert.equal(asUuidOrNull("not-a-uuid"), null);
  assert.equal(asUuidOrNull("00000000-0000-0000-0000-00000000000g"), null);
});

test("asUuidOrNull accepts real UUIDs", () => {
  const id = "596286e3-f3ae-4a80-859e-bd824ed2f779";
  assert.equal(asUuidOrNull(id), id);
  assert.equal(asUuidOrNull(`  ${id}  `), id);
  assert.equal(asUuidOrNull("00000000-0000-0000-0000-000000000000"), "00000000-0000-0000-0000-000000000000");
});

test("approval payload never embeds system as requested_by", () => {
  // Mirrors the agent_approval_queue insert shape used by toggle_facebook_campaign.
  const userId = "system";
  const payload = {
    tenant_id: "2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019",
    agent_id: null,
    requested_by: asUuidOrNull(userId),
    approved_by: asUuidOrNull(userId),
    tool_name: "toggle_facebook_campaign",
  };
  assert.equal(payload.requested_by, null);
  assert.equal(payload.approved_by, null);
  assert.notEqual(payload.requested_by, "system");
});
