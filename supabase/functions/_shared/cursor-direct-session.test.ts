import assert from "node:assert/strict";
import test from "node:test";
import {
  asCursorSessionId,
  cursorSessionUrl,
  missingCursorDirectSessionError,
  resolveCursorDirectSession,
} from "./cursor-direct-session.ts";

test("asCursorSessionId accepts bc- ids only", () => {
  assert.equal(asCursorSessionId("bc-abc"), "bc-abc");
  assert.equal(asCursorSessionId("nope"), null);
});

test("resolveCursorDirectSession prefers CURSOR_DIRECT_AGENT_ID", async () => {
  const session = await resolveCursorDirectSession(null, {
    tenantId: "t1",
    env: { CURSOR_DIRECT_AGENT_ID: "bc-direct", CURSOR_STICKY_AGENT_ID: "bc-sticky" },
  });
  assert.deepEqual(session, {
    sessionId: "bc-direct",
    sessionUrl: cursorSessionUrl("bc-direct"),
    source: "env:CURSOR_DIRECT_AGENT_ID",
  });
});

test("resolveCursorDirectSession falls back to cursor_sticky_agents", async () => {
  const sb = {
    from(table: string) {
      const chain: any = {
        select() { return chain; },
        eq() { return chain; },
        not() { return chain; },
        order() { return chain; },
        limit() { return chain; },
        maybeSingle: async () => (
          table === "cursor_sticky_agents"
            ? { data: { cursor_agent_id: "bc-sticky-db", session_url: "https://cursor.com/agents/bc-sticky-db" } }
            : { data: null }
        ),
        then(resolve: (v: { data: unknown }) => unknown) {
          return Promise.resolve({ data: [] }).then(resolve);
        },
      };
      return chain;
    },
  };
  const session = await resolveCursorDirectSession(sb, { tenantId: "t1", env: {} });
  assert.equal(session?.sessionId, "bc-sticky-db");
  assert.equal(session?.source, "db:cursor_sticky_agents");
});

test("resolveCursorDirectSession returns null when nothing configured", async () => {
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
  const session = await resolveCursorDirectSession(sb, { tenantId: "t1", env: {} });
  assert.equal(session, null);
  assert.match(missingCursorDirectSessionError(), /CURSOR_DIRECT_AGENT_ID/);
  assert.match(missingCursorDirectSessionError(), /ask_cursor/);
});
