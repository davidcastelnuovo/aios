import assert from "node:assert/strict";
import {
  canAccessCommandCenterPage,
  canAccessCommandCenterSidecar,
  COMMAND_CENTER_PERMISSION_MODULES,
  devEscalationTierFromCommandCenter,
  permissionRowsForTier,
  tierFromPermissionMap,
} from "./commandCenterAccess.ts";

assert.equal(tierFromPermissionMap({ [COMMAND_CENTER_PERMISSION_MODULES.full]: true }), "full");
assert.equal(tierFromPermissionMap({ [COMMAND_CENTER_PERMISSION_MODULES.bugfix]: true }), "bugfix");
assert.equal(tierFromPermissionMap({}), null);

assert.equal(canAccessCommandCenterPage("full"), true);
assert.equal(canAccessCommandCenterPage("sidecar"), false);
assert.equal(canAccessCommandCenterSidecar("sidecar"), true);

assert.equal(devEscalationTierFromCommandCenter("full"), "full");
assert.equal(devEscalationTierFromCommandCenter("bugfix"), "bugfix");
assert.equal(devEscalationTierFromCommandCenter("sidecar"), null);

const rows = permissionRowsForTier("sidecar");
assert.equal(rows.filter((r) => r.can_access).length, 1);

console.log("commandCenterAccess.test.ts OK");
