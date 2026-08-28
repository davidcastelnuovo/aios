import assert from "node:assert/strict";
import test from "node:test";
import { checkOutbound, isSafeModeEnabled, parseAllowlist } from "./integrationGuard.ts";

test("production always allows even if safe mode is set", () => {
  const result = checkOutbound({
    appEnv: "production",
    stagingSafeMode: "true",
    integration: "whatsapp",
    destination: "0500000000",
  });
  assert.equal(result.decision, "ALLOW");
  assert.equal(isSafeModeEnabled("production", "true"), false);
});

test("unset env is treated as production and allows", () => {
  const result = checkOutbound({
    integration: "whatsapp",
    destination: "0500000000",
  });
  assert.equal(result.decision, "ALLOW");
  assert.equal(result.environment, "production");
});

test("staging safe mode blocks destinations not on the allowlist", () => {
  const blocked = checkOutbound({
    appEnv: "staging",
    stagingSafeMode: "true",
    integration: "whatsapp",
    destination: "972501111111",
    allowlistRaw: "972502222222",
  });
  assert.equal(blocked.decision, "BLOCK");

  const allowed = checkOutbound({
    appEnv: "staging",
    stagingSafeMode: "true",
    integration: "whatsapp",
    destination: "0502222222",
    allowlistRaw: "972502222222",
  });
  assert.equal(allowed.decision, "ALLOW");
});

test("empty allowlist blocks all WhatsApp in staging", () => {
  const result = checkOutbound({
    appEnv: "staging",
    integration: "whatsapp",
    destination: "972501111111",
  });
  assert.equal(result.decision, "BLOCK");
  assert.equal(result.reason, "empty_allowlist");
});

test("staging blocks WhatsApp groups", () => {
  const result = checkOutbound({
    appEnv: "staging",
    integration: "whatsapp",
    destination: "group:123@g.us",
  });
  assert.equal(result.decision, "BLOCK");
});

test("parseAllowlist splits commas and spaces", () => {
  assert.deepEqual(parseAllowlist("972501111111, 0502222222"), ["972501111111", "0502222222"]);
});
