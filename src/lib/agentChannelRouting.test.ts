import assert from "node:assert/strict";
import test from "node:test";
import {
  FALLBACK_BRAIN_ROUTES,
  DEFAULT_BRAIN_SLUG,
  deriveParliamentView,
  groupLabel,
  isInputLocked,
  parliamentSeats,
  pickDefaultRoute,
  sendPathForRoute,
  speakerLabel,
  hudStage,
  slugForCouncilSeat,
  councilSeatFromSlug,
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
  assert.equal(speakerLabel("codex"), "Codex");
  assert.equal(speakerLabel("carmen", "internal"), "כרמן");
  assert.equal(groupLabel("direct_channel"), "ערוץ ישיר");
});

test("default brain is Cursor Direct", () => {
  assert.equal(DEFAULT_BRAIN_SLUG, "cursor");
  assert.equal(pickDefaultRoute(FALLBACK_BRAIN_ROUTES).slug, "cursor");
  assert.equal(pickDefaultRoute(FALLBACK_BRAIN_ROUTES, "grok").slug, "grok");
});

test("HUD stays on the round table for council, solo for a direct chat", () => {
  assert.equal(hudStage({ userStage: "direct", routeType: "direct_channel" }), "direct");
  assert.equal(hudStage({ userStage: "direct", routeType: "parliament" }), "table");
  assert.equal(hudStage({ userStage: "direct", debating: true }), "table");
  assert.equal(hudStage({ userStage: "table", routeType: "internal" }), "table");
  assert.equal(slugForCouncilSeat("carmen"), "internal");
  assert.equal(councilSeatFromSlug("internal"), "carmen");
  assert.equal(councilSeatFromSlug("parliament"), null);
});

test("parliament seats are Cursor + Grok + Codex", () => {
  const p = FALLBACK_BRAIN_ROUTES.find((r) => r.slug === "parliament")!;
  assert.deepEqual(parliamentSeats(p), ["cursor", "grok", "codex"]);
});

test("parliament view maps seat replies and advances to review round", () => {
  const p = FALLBACK_BRAIN_ROUTES.find((r) => r.slug === "parliament")!;
  const view = deriveParliamentView([
    { role: "user", content: "איך לשחרר את הדופק?" },
    { role: "tool_call", tool: "פרלמנט נפתח — סבב 1", channel: "parliament" },
    { role: "assistant", speaker: "cursor", channel: "cursor", content: "תקן את ה-JID" },
    { role: "tool_call", tool: "סבב ביקורת — כל מושב מקבל את תשובות האחרים." },
  ], p);
  assert.equal(view.round, 2);
  assert.equal(view.topic, "איך לשחרר את הדופק?");
  const cursor = view.seats.find((s) => s.provider === "cursor")!;
  const grok = view.seats.find((s) => s.provider === "grok")!;
  assert.equal(cursor.state, "reviewing");
  assert.equal(grok.state, "waiting");
  assert.match(cursor.preview || "", /JID/);
});
