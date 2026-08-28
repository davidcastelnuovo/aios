import assert from "node:assert/strict";
import test from "node:test";
import { resolveAppEnv } from "./appEnv.ts";

test("unset APP_ENV is production so existing deploys stay open", () => {
  assert.equal(resolveAppEnv(undefined), "production");
  assert.equal(resolveAppEnv(""), "production");
  assert.equal(resolveAppEnv("staging"), "staging");
  assert.equal(resolveAppEnv("PREVIEW"), "preview");
});
