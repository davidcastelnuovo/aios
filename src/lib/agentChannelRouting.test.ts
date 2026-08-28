import assert from "node:assert/strict";
import test from "node:test";
import {
  FALLBACK_BRAIN_ROUTES,
  groupLabel,
  isInputLocked,
  parliamentSeats,
  sendPathForRoute,
  speakerLabel,
} from "./agentChannelRouting.ts";

test("selecting a direct channel changes the send path", () => {
  const internal = FALLBACK_BRAIN_ROUTES.find((r) => r.slug === "internal")!;
  const cursor = FALLBACK_BRAIN_ROUTES.find((r) => r.slug === "cursor")!;
  const parliament = FALLBACK_BRAIN_ROUTES.find((r) => r.slug === "parliament")!;
  assert.equal(sendPathForRoute(internal), "internal_stream");
  assert.equal(sendPathForRoute(cursor), "channel_gateway");
  assert.equal(sendPathForRoute(parliament), "channel_gateway");
});

test("debate and waiting_external lock the composer", () => {
  assert.equal(isInputLocked("idle"), false);
  assert.equal(isInputLocked("debating"), true);
  assert.equal(isInputLocked("waiting_external"), true);
});

test("speaker labels distinguish channels", () => {
  assert.equal(speakerLabel("cursor"), "Cursor");
  assert.equal(speakerLabel("carmen", "internal"), "כרמן");
  assert.equal(groupLabel("direct_channel"), "ערוץ ישיר");
});

test("parliament MVP seats are Cursor + Grok", () => {
  const p = FALLBACK_BRAIN_ROUTES.find((r) => r.slug === "parliament")!;
  assert.deepEqual(parliamentSeats(p), ["cursor", "grok"]);
});
