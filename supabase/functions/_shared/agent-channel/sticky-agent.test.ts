import assert from "node:assert/strict";
import test from "node:test";
import {
  allowCreateNewCloudAgent,
  asCloudAgentId,
  billingNoteForSeat,
  busyOpenChatMessage,
  collectOpenChatIds,
  cursorDirectStickyEnabled,
  envOpenChatId,
  missingOpenChatMessage,
  uniqueCloudAgentIds,
} from "./sticky-agent.ts";

test("only bc- ids count as an open Cursor chat", () => {
  assert.equal(asCloudAgentId("bc-7eb07a1e-7143-4b20-bf1e-fc529a24cc5c"), "bc-7eb07a1e-7143-4b20-bf1e-fc529a24cc5c");
  assert.equal(asCloudAgentId("webhook-1"), null);
  assert.deepEqual(
    uniqueCloudAgentIds("bc-aaa", "nope", "bc-aaa", "bc-bbb"),
    ["bc-aaa", "bc-bbb"],
  );
});

test("Cursor Direct prefers CURSOR_DIRECT_AGENT_ID over the coding sticky", () => {
  assert.equal(
    envOpenChatId("cursor", {
      CURSOR_DIRECT_AGENT_ID: "bc-direct",
      CURSOR_STICKY_AGENT_ID: "bc-coding",
    }),
    "bc-direct",
  );
  assert.equal(envOpenChatId("cursor", { CURSOR_STICKY_AGENT_ID: "bc-coding" }), "bc-coding");
  assert.equal(envOpenChatId("codex", { CODEX_DIRECT_AGENT_ID: "bc-codex" }), "bc-codex");
  assert.equal(envOpenChatId("codex", { CURSOR_DIRECT_AGENT_ID: "bc-direct" }), null);
});

test("new Background Agents are allowed by default; sticky is opt-in", () => {
  assert.equal(cursorDirectStickyEnabled({}), false);
  assert.equal(cursorDirectStickyEnabled({ CURSOR_DIRECT_STICKY: "true" }), true);
  assert.equal(allowCreateNewCloudAgent({}), true);
  assert.equal(allowCreateNewCloudAgent({ CURSOR_DIRECT_ALLOW_CREATE: "false" }), false);
  assert.equal(allowCreateNewCloudAgent({ CURSOR_DIRECT_STICKY: "true" }), false);
  assert.equal(
    allowCreateNewCloudAgent({ CURSOR_DIRECT_STICKY: "true", CURSOR_DIRECT_ALLOW_CREATE: "true" }),
    true,
  );
});

test("Cursor is Carmen Direct; Codex is ChatGPT Workspace", () => {
  assert.match(billingNoteForSeat("cursor"), /סוכן Cursor חדש/);
  assert.match(billingNoteForSeat("codex"), /Workspace/);
  assert.match(billingNoteForSeat("internal"), /OpenAI API/);
  assert.match(missingOpenChatMessage("cursor"), /Cursor Direct/);
  assert.match(missingOpenChatMessage("codex"), /Workspace/);
  assert.match(busyOpenChatMessage("cursor", "https://cursor.com/agents/bc-1"), /מקביל/);
});

test("collectOpenChatIds without sticky only returns the current session", async () => {
  const calls: string[] = [];
  const sb = {
    from(table: string) {
      calls.push(table);
      const chain: any = {
        select() { return chain; },
        eq() { return chain; },
        not() { return chain; },
        order() { return chain; },
        limit() { return chain; },
        maybeSingle: async () => ({ data: { cursor_agent_id: "bc-sticky" } }),
        then(resolve: (v: { data: unknown }) => unknown) {
          return Promise.resolve({ data: [] }).then(resolve);
        },
      };
      return chain;
    },
  };

  const ids = await collectOpenChatIds(sb, {
    tenantId: "t1",
    provider: "cursor",
    sessionId: "bc-this-chat",
    env: { CURSOR_DIRECT_AGENT_ID: "bc-direct" },
  });
  assert.deepEqual(ids, ["bc-this-chat"]);
  assert.equal(calls.length, 0);
});

test("collectOpenChatIds with sticky merges session, env, sticky table, then last sessions", async () => {
  const calls: string[] = [];
  const sb = {
    from(table: string) {
      calls.push(table);
      const row =
        table === "cursor_sticky_agents" ? { cursor_agent_id: "bc-sticky", session_url: "https://cursor.com/agents/bc-sticky" }
        : null;
      const rows = table === "agent_channel_sessions"
        ? [{ external_session_id: "bc-session-old" }]
        : null;
      const chain: any = {
        select() { return chain; },
        eq() { return chain; },
        not() { return chain; },
        order() { return chain; },
        limit() { return chain; },
        maybeSingle: async () => ({ data: row }),
        then(resolve: (v: { data: unknown }) => unknown) {
          return Promise.resolve({ data: rows }).then(resolve);
        },
      };
      return chain;
    },
  };

  const ids = await collectOpenChatIds(sb, {
    tenantId: "t1",
    provider: "cursor",
    sessionId: "bc-this-chat",
    env: { CURSOR_DIRECT_AGENT_ID: "bc-direct", CURSOR_DIRECT_STICKY: "true" },
  });
  assert.deepEqual(ids, [
    "bc-this-chat",
    "bc-direct",
    "bc-session-old",
  ]);
  assert.ok(calls.includes("agent_channel_sessions"));
});

test("Cursor Direct without sticky and without session returns empty list", async () => {
  const sb = {
    from() {
      const chain: any = {
        select() { return chain; },
        eq() { return chain; },
        not() { return chain; },
        order() { return chain; },
        limit() { return chain; },
        maybeSingle: async () => ({ data: null }),
        then(resolve: (v: { data: unknown }) => unknown) {
          return Promise.resolve({ data: [] }).then(resolve);
        },
      };
      return chain;
    },
  };
  const ids = await collectOpenChatIds(sb, { tenantId: "t1", provider: "cursor", env: {} });
  assert.deepEqual(ids, []);
  const codex = await collectOpenChatIds(sb, { tenantId: "t1", provider: "codex", env: {} });
  assert.deepEqual(codex, []);
});
