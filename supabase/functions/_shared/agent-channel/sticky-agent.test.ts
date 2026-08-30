import assert from "node:assert/strict";
import test from "node:test";
import {
  allowCreateNewCloudAgent,
  asCloudAgentId,
  billingNoteForSeat,
  busyOpenChatMessage,
  collectOpenChatIds,
  envOpenChatId,
  missingOpenChatMessage,
  uniqueCloudAgentIds,
} from "./sticky-agent.ts";

test("only bc- ids count as an open Cursor chat", () => {
  assert.equal(asCloudAgentId("bc-7eb07a1e-7143-4b20-bf1e-fc529a24cc5c"), "bc-7eb07a1e-7143-4b20-bf1e-fc529a24cc5c");
  assert.equal(asCloudAgentId("webhook-1"), null);
  assert.equal(asCloudAgentId(""), null);
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

test("new Background Agents stay off unless explicitly allowed", () => {
  assert.equal(allowCreateNewCloudAgent({}), false);
  assert.equal(allowCreateNewCloudAgent({ CURSOR_DIRECT_ALLOW_CREATE: "true" }), true);
});

test("Codex billing copy is Cursor Cloud, not OpenAI or ChatGPT Plus", () => {
  assert.match(billingNoteForSeat("codex"), /Cursor Cloud/);
  assert.match(billingNoteForSeat("codex"), /לא קרדיט OpenAI/);
  assert.match(billingNoteForSeat("codex"), /לא מנוי ChatGPT/);
  assert.match(billingNoteForSeat("chatgpt"), /לא Codex/);
  assert.match(billingNoteForSeat("internal"), /OpenAI API/);
  assert.match(missingOpenChatMessage("cursor"), /כבר פתוח/);
  assert.match(missingOpenChatMessage("codex"), /לא קרדיט OpenAI ולא מנוי ChatGPT/);
  assert.match(busyOpenChatMessage("cursor", "https://cursor.com/agents/bc-1"), /עדיין רץ/);
});

test("collectOpenChatIds merges session, env, sticky table, then last sessions", async () => {
  const calls: string[] = [];
  const sb = {
    from(table: string) {
      calls.push(table);
      const row =
        table === "cursor_sticky_agents" ? { cursor_agent_id: "bc-sticky" }
        : table === "cursor_dispatches" ? { cursor_agent_id: "bc-dispatch" }
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
    env: { CURSOR_DIRECT_AGENT_ID: "bc-direct" },
  });
  assert.deepEqual(ids, ["bc-this-chat", "bc-direct", "bc-sticky", "bc-dispatch", "bc-session-old"]);
  assert.ok(calls.includes("cursor_sticky_agents"));
});
