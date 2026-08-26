import assert from "node:assert/strict";
import test from "node:test";
import { CURSOR_CREATIVE_SPEND_MESSAGE, isCursorCreativeSpendError, isCursorCreativeUnavailable } from "./cursorCreativeUnavailable.ts";

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

test("Cloud Agent spend is distinct from a missing function", () => {
  assert.equal(isCursorCreativeSpendError(new Error("no credits remaining")), true);
  assert.equal(isCursorCreativeSpendError(new Error("Enable on-demand usage")), true);
  assert.equal(isCursorCreativeSpendError(new Error("Cursor agent create 402: payment required")), true);
  assert.equal(isCursorCreativeSpendError(new Error("נגמרו הקרדיטים")), true);
  assert.equal(isCursorCreativeSpendError(new Error("unauthorized")), false);
  assert.match(CURSOR_CREATIVE_SPEND_MESSAGE, /Pro\+/);
  assert.match(CURSOR_CREATIVE_SPEND_MESSAGE, /dashboard\/spending/);
  assert.match(CURSOR_CREATIVE_SPEND_MESSAGE, /Creative Direct/);
});
