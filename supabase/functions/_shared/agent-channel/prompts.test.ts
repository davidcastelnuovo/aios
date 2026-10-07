import assert from "node:assert/strict";
import test from "node:test";
import { buildCodexWorkspaceAgentInput } from "./prompts.ts";

test("Codex workspace input uses MCP delivery without secrets", () => {
  const input = buildCodexWorkspaceAgentInput({
    userText: "בדיקת codex",
    conversationId: "conv-1",
    sessionId: "sess-1",
    tenantId: "tenant-1",
    environment: "production",
  });
  assert.match(input, /\[AIOS Command Center · Codex Direct\]/);
  assert.match(input, /AIOS Agent Channel — Production/);
  assert.match(input, /reply_to_aios_session exactly once/);
  assert.match(input, /conversation_id: conv-1/);
  assert.match(input, /environment: production/);
  assert.doesNotMatch(input, /Authorization: Bearer/);
  assert.doesNotMatch(input, /agent-channel-callback/);
});

test("Codex workspace input selects Staging MCP by project ref", () => {
  const input = buildCodexWorkspaceAgentInput({
    userText: "ping",
    conversationId: "c",
    sessionId: "s",
    tenantId: "t",
    environment: "staging",
    parliamentRound: 2,
  });
  assert.match(input, /AIOS Agent Channel — Staging/);
  assert.match(input, /environment: staging/);
  assert.match(input, /parliament_round: 2/);
});

test("Codex workspace input carries attachments and forbids forwarding", () => {
  const input = buildCodexWorkspaceAgentInput({
    userText: "",
    conversationId: "c",
    sessionId: "s",
    tenantId: "t",
    environment: "production",
    attachments: [{ type: "image", name: "a.png", url: "https://x/a.png" } as any],
  });
  assert.match(input, /no text — see attached files/);
  assert.match(input, /a\.png → https:\/\/x\/a\.png/);
  assert.match(input, /Do not forward it to Cursor/);
});
