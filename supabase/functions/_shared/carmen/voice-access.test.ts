import test from "node:test";
import assert from "node:assert/strict";
import { orgVoiceKeyAllowed } from "./voice-access.ts";

test("owner may use the org key on Production", () => {
  assert.equal(
    orgVoiceKeyAllowed("david.castelnuovo@gmail.com", "production"),
    true,
  );
});

test("other users need a personal key on Production", () => {
  assert.equal(orgVoiceKeyAllowed("admin@aios.test", "production"), false);
  assert.equal(orgVoiceKeyAllowed("admin@aios.test", undefined), false);
  assert.equal(orgVoiceKeyAllowed("admin@aios.test", "bogus"), false);
});

test("every signed-in user may use the org key outside Production", () => {
  assert.equal(orgVoiceKeyAllowed("admin@aios.test", "preview"), true);
  assert.equal(orgVoiceKeyAllowed("admin@aios.test", "staging"), true);
  assert.equal(orgVoiceKeyAllowed(null, "preview"), false);
});
