import assert from "node:assert/strict";
import test from "node:test";
import { FALLBACK_BRAIN_ROUTES } from "./agentChannelRouting.ts";
import { filterMessagesForRoute, messageSpeakerKey, seatKeyFromRoute } from "./agentSeats.ts";

test("seat key maps parliament to shared and cursor to direct", () => {
  const parliament = FALLBACK_BRAIN_ROUTES.find((r) => r.slug === "parliament")!;
  const cursor = FALLBACK_BRAIN_ROUTES.find((r) => r.slug === "cursor")!;
  assert.equal(seatKeyFromRoute(parliament), "shared");
  assert.equal(seatKeyFromRoute(cursor), "cursor");
});

test("shared space shows all agent lines; direct hides other agents", () => {
  const parliament = FALLBACK_BRAIN_ROUTES.find((r) => r.slug === "parliament")!;
  const cursor = FALLBACK_BRAIN_ROUTES.find((r) => r.slug === "cursor")!;
  const msgs = [
    { role: "user", content: "hi" },
    { role: "assistant", speaker: "cursor", content: "a" },
    { role: "assistant", speaker: "grok", content: "b" },
  ];
  assert.equal(filterMessagesForRoute(msgs, parliament).length, 3);
  assert.equal(filterMessagesForRoute(msgs, cursor).length, 2);
  assert.equal(messageSpeakerKey({ role: "assistant", speaker: "codex" }), "codex");
});
