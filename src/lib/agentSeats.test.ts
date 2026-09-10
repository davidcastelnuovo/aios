import assert from "node:assert/strict";
import test from "node:test";
import { FALLBACK_BRAIN_ROUTES } from "./agentChannelRouting.ts";
import {
  conversationMatchesRoute,
  conversationsForRoute,
  filterMessagesForRoute,
  messageSpeakerKey,
  seatKeyFromRoute,
} from "./agentSeats.ts";

test("seat key maps parliament to shared and cursor to direct", () => {
  const parliament = FALLBACK_BRAIN_ROUTES.find((r) => r.slug === "parliament")!;
  const cursor = FALLBACK_BRAIN_ROUTES.find((r) => r.slug === "cursor")!;
  assert.equal(seatKeyFromRoute(parliament), "shared");
  assert.equal(seatKeyFromRoute(cursor), "cursor");
});

test("shared space shows all agent lines; direct hides other agents and their user lines", () => {
  const parliament = FALLBACK_BRAIN_ROUTES.find((r) => r.slug === "parliament")!;
  const cursor = FALLBACK_BRAIN_ROUTES.find((r) => r.slug === "cursor")!;
  const carmen = FALLBACK_BRAIN_ROUTES.find((r) => r.slug === "internal")!;
  const msgs = [
    { role: "user", content: "ask carmen", channel: "internal" },
    { role: "assistant", speaker: "carmen", channel: "internal", content: "c" },
    { role: "user", content: "ask cursor", channel: "cursor" },
    { role: "assistant", speaker: "cursor", channel: "cursor", content: "a" },
    { role: "assistant", speaker: "grok", channel: "grok", content: "b" },
  ];
  assert.equal(filterMessagesForRoute(msgs, parliament).length, 5);
  assert.equal(filterMessagesForRoute(msgs, cursor).length, 2);
  assert.deepEqual(
    filterMessagesForRoute(msgs, cursor).map((m) => m.content),
    ["ask cursor", "a"],
  );
  assert.deepEqual(
    filterMessagesForRoute(msgs, carmen).map((m) => m.content),
    ["ask carmen", "c"],
  );
  assert.equal(messageSpeakerKey({ role: "assistant", speaker: "codex" }), "codex");
});

test("untagged legacy user lines stay on Carmen, not Cursor Direct", () => {
  const cursor = FALLBACK_BRAIN_ROUTES.find((r) => r.slug === "cursor")!;
  const carmen = FALLBACK_BRAIN_ROUTES.find((r) => r.slug === "internal")!;
  const msgs = [
    { role: "user", content: "old carmen ask" },
    { role: "assistant", speaker: "carmen", content: "old reply" },
  ];
  assert.equal(filterMessagesForRoute(msgs, cursor).length, 0);
  assert.equal(filterMessagesForRoute(msgs, carmen).length, 2);
});

test("conversation list is scoped to the active seat", () => {
  const cursor = { ...FALLBACK_BRAIN_ROUTES.find((r) => r.slug === "cursor")!, id: "route-cursor" };
  const grok = { ...FALLBACK_BRAIN_ROUTES.find((r) => r.slug === "grok")!, id: "route-grok" };
  const carmen = FALLBACK_BRAIN_ROUTES.find((r) => r.slug === "internal")!;
  const parliament = FALLBACK_BRAIN_ROUTES.find((r) => r.slug === "parliament")!;
  const routes = [cursor, grok, carmen, parliament];
  const items = [
    { id: "1", updated_at: "2026-01-01", routing_mode: "direct_channel", brain_route_id: "route-cursor" },
    { id: "2", updated_at: "2026-01-02", routing_mode: "internal" },
    { id: "3", updated_at: "2026-01-03", routing_mode: "parliament" },
    { id: "4", updated_at: "2026-01-04" },
    { id: "5", updated_at: "2026-01-05", routing_mode: "direct_channel", brain_route_id: "route-grok" },
    { id: "6", updated_at: "2026-01-06", routing_mode: "direct_channel" },
  ];
  assert.deepEqual(conversationsForRoute(items, cursor, routes).map((c) => c.id), ["1"]);
  assert.deepEqual(conversationsForRoute(items, grok, routes).map((c) => c.id), ["5"]);
  assert.deepEqual(conversationsForRoute(items, carmen, routes).map((c) => c.id), ["2", "4"]);
  assert.deepEqual(conversationsForRoute(items, parliament, routes).map((c) => c.id), ["3"]);
  assert.equal(conversationMatchesRoute({ routing_mode: "direct_channel" }, cursor, routes), false);
});
