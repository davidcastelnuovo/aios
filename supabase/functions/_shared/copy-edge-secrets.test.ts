import assert from "node:assert/strict";
import test from "node:test";
import {
  AGENT_EDGE_SECRET_ALLOWLIST,
  assertSafeTargetRef,
  isForbiddenSecretName,
  projectRefFromSupabaseUrl,
  selectSecretsToCopy,
} from "./copy-edge-secrets.ts";

test("default copy list is the agent allowlist", () => {
  assert.deepEqual(selectSecretsToCopy(null), [...AGENT_EDGE_SECRET_ALLOWLIST]);
  assert.ok(selectSecretsToCopy(null).includes("CURSOR_API_KEY"));
});

test("requested names are filtered to the allowlist", () => {
  assert.deepEqual(
    selectSecretsToCopy(["CURSOR_API_KEY", "META_WHATSAPP_CONFIG_ID", "SUPABASE_DB_URL", "nope"]),
    ["CURSOR_API_KEY"],
  );
});

test("customer and project secrets are forbidden", () => {
  assert.equal(isForbiddenSecretName("META_WHATSAPP_WEBHOOK_VERIFY_TOKEN"), true);
  assert.equal(isForbiddenSecretName("FACEBOOK_APP_SECRET"), true);
  assert.equal(isForbiddenSecretName("SUPABASE_SERVICE_ROLE_KEY"), true);
  assert.equal(isForbiddenSecretName("CURSOR_API_KEY"), false);
});

test("refuses copying onto the source project", () => {
  const src = "zvoijyneresvkadpprel";
  assert.equal(assertSafeTargetRef("mzjsuvatrzhciojmbbbm", src), "mzjsuvatrzhciojmbbbm");
  assert.throws(() => assertSafeTargetRef(src, src), /source project/);
  assert.throws(() => assertSafeTargetRef("not-a-ref", src), /invalid/);
});

test("project ref from supabase url", () => {
  assert.equal(projectRefFromSupabaseUrl("https://zvoijyneresvkadpprel.supabase.co"), "zvoijyneresvkadpprel");
});
