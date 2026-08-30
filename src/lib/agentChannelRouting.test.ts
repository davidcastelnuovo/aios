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
  routeForTableAddress,
  channelHealthBanner,
  billingNoteForRoute,
  initialSelectedRoute,
  routeForRestoredChat,
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

test("default brain is the knights table; first paint ignores a saved Cursor slug", () => {
  assert.equal(DEFAULT_BRAIN_SLUG, "parliament");
  assert.equal(pickDefaultRoute(FALLBACK_BRAIN_ROUTES).slug, "parliament");
  assert.equal(pickDefaultRoute(FALLBACK_BRAIN_ROUTES, "grok").slug, "grok");
  assert.equal(initialSelectedRoute("tenant-with-saved-cursor").slug, "parliament");
  assert.equal(hudStage({ routeType: initialSelectedRoute(null).route_type }), "table");
});

test("restored chat keeps its own brain; empty session stays on the table", () => {
  const routes = FALLBACK_BRAIN_ROUTES;
  assert.equal(routeForRestoredChat(routes, { routing_mode: "parliament" }).slug, "parliament");
  assert.equal(routeForRestoredChat(routes, { routing_mode: "direct_channel", brain_route_id: "fallback-cursor" }).slug, "cursor");
  assert.equal(routeForRestoredChat(routes, null).slug, "parliament");
});

test("HUD is solo for Direct Chat tabs, table only for Knights Round Table", () => {
  assert.equal(hudStage({ routeType: "direct_channel" }), "direct");
  assert.equal(hudStage({ routeType: "internal" }), "direct");
  assert.equal(hudStage({ routeType: "parliament" }), "table");
  assert.equal(hudStage({ debating: true }), "table");
  assert.equal(slugForCouncilSeat("carmen"), "internal");
  assert.equal(councilSeatFromSlug("internal"), "carmen");
  assert.equal(councilSeatFromSlug("parliament"), null);
});

test("table address picks a seat route without leaving parliament HUD", () => {
  const routes = FALLBACK_BRAIN_ROUTES;
  assert.equal(routeForTableAddress(routes, null)?.slug, "parliament");
  assert.equal(routeForTableAddress(routes, "cursor")?.slug, "cursor");
  assert.equal(routeForTableAddress(routes, "carmen")?.slug, "internal");
  assert.equal(hudStage({ routeType: "parliament" }), "table");
});

test("channel health banner only when Cursor key is rejected", () => {
  assert.equal(channelHealthBanner(null), null);
  assert.equal(channelHealthBanner({ ok: true, cursor: { ok: true, status: 200 } }), null);
  assert.equal(channelHealthBanner({ ok: false }), null);
  const banner = channelHealthBanner({ ok: false, cursor: { ok: false, status: 401 } });
  assert.match(banner || "", /CURSOR_API_KEY/);
  assert.match(banner || "", /Staging/);
  assert.match(banner || "", /כרמן הפנימית עובדת/);
});

test("health banner explains a missing open Cursor chat", () => {
  const banner = channelHealthBanner({
    ok: true,
    cursor: { ok: true, status: 200 },
    seats: { cursor: { open_chat: false } },
  });
  assert.match(banner || "", /כבר פתוח/);
  assert.match(banner || "", /לא מנוי ChatGPT/);
});

test("Codex billing note is Cursor Cloud, not OpenAI or ChatGPT Plus", () => {
  assert.match(billingNoteForRoute("codex") || "", /Cursor Cloud/);
  assert.match(billingNoteForRoute("codex") || "", /לא קרדיט OpenAI/);
  assert.match(billingNoteForRoute("chatgpt") || "", /לא Codex/);
  assert.match(billingNoteForRoute("cursor") || "", /צ'אט Cursor פתוח/);
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
