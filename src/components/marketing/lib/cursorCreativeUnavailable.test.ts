import assert from "node:assert/strict";
import test from "node:test";
import { isCursorCreativeUnavailable } from "./cursorCreativeUnavailable.ts";

test("missing edge function falls back to local generation", () => {
  assert.equal(isCursorCreativeUnavailable(new Error("Requested function was not found")), true);
  assert.equal(isCursorCreativeUnavailable(new Error("Failed to send a request to the Edge Function")), true);
});

test("live agent errors do not silently fall back to local generation", () => {
  assert.equal(isCursorCreativeUnavailable(new Error("unauthorized")), false);
  assert.equal(isCursorCreativeUnavailable(new Error("CURSOR_API_KEY is not configured")), false);
  assert.equal(isCursorCreativeUnavailable(new Error("item not found")), false);
  assert.equal(isCursorCreativeUnavailable(new Error("Cursor agent create 401: invalid key")), false);
  assert.equal(isCursorCreativeUnavailable(new Error("אייג׳נט הקריאייטיב נכשל")), false);
});
