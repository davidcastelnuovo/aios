import assert from "node:assert/strict";
import test from "node:test";
import {
  permissionForSubpath,
  permissionHandleForPathname,
} from "./moduleRoutePermissions.ts";

test("leads and lead-integrations keep distinct permissions", () => {
  assert.equal(permissionForSubpath("leads"), "leads");
  assert.equal(permissionForSubpath("leads/archive"), "leads");
  assert.equal(permissionForSubpath("lead-integrations"), "lead_integrations");
  assert.equal(
    permissionHandleForPathname("/t/acme/lead-integrations")?.permission,
    "lead_integrations",
  );
});

test("chat-integrations is not treated as chat/:id", () => {
  assert.equal(permissionForSubpath("chat-integrations"), "chat_integrations");
  assert.equal(permissionForSubpath("chat/abc-123"), "chat");
});

test("tenant index uses dashboard permission; ungated pages stay open", () => {
  assert.equal(permissionHandleForPathname("/t/acme")?.permission, "dashboard");
  assert.equal(permissionHandleForPathname("/t/acme/")?.permission, "dashboard");
  assert.equal(permissionHandleForPathname("/t/acme/home"), undefined);
  assert.equal(permissionHandleForPathname("/t/acme/my-profile"), undefined);
  assert.equal(permissionHandleForPathname("/auth"), undefined);
});

test("org dashboard module stays gated; client dashboard entity route does not", () => {
  assert.equal(permissionForSubpath("dashboard"), "dashboard");
  assert.equal(permissionHandleForPathname("/t/acme/dashboard")?.permission, "dashboard");
  assert.equal(permissionForSubpath("dashboard/abc-123"), undefined);
  assert.equal(
    permissionHandleForPathname("/t/marketingcaptain/dashboard/abc-123")?.permission,
    undefined,
  );
});
