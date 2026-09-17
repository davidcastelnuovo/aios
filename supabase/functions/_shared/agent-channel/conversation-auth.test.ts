import assert from "node:assert/strict";
import test from "node:test";
import { authorizeConversationAction, authorizeParliamentRun } from "./conversation-auth.ts";

const tenantA = "11111111-1111-1111-1111-111111111111";
const tenantB = "22222222-2222-2222-2222-222222222222";
const convA = {
  id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  tenant_id: tenantA,
  agent_id: "agent-a",
};

test("same-tenant conversation is allowed", () => {
  const result = authorizeConversationAction({ conversation: convA, tenantId: tenantA });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.conversation.id, convA.id);
});

test("cross-tenant conversation_id is 404 even with a valid caller tenant", () => {
  const result = authorizeConversationAction({ conversation: convA, tenantId: tenantB });
  assert.deepEqual(result, { ok: false, status: 404, error: "not_found" });
});

test("missing conversation is 404", () => {
  assert.deepEqual(
    authorizeConversationAction({ conversation: null, tenantId: tenantA }),
    { ok: false, status: 404, error: "not_found" },
  );
});

test("claimed agent_id from another conversation is 403", () => {
  const result = authorizeConversationAction({
    conversation: convA,
    tenantId: tenantA,
    claimedAgentId: "agent-b",
  });
  assert.deepEqual(result, { ok: false, status: 403, error: "forbidden" });
});

test("omitted claimed agent_id does not block", () => {
  const result = authorizeConversationAction({ conversation: convA, tenantId: tenantA, claimedAgentId: "" });
  assert.equal(result.ok, true);
});

test("parliament run from another tenant is 404", () => {
  const result = authorizeParliamentRun({
    run: { id: "run-1", tenant_id: tenantA, conversation_id: convA.id },
    tenantId: tenantB,
    conversationId: convA.id,
  });
  assert.deepEqual(result, { ok: false, status: 404, error: "not_found" });
});

test("parliament run for the same tenant is allowed", () => {
  const result = authorizeParliamentRun({
    run: { id: "run-1", tenant_id: tenantA, conversation_id: convA.id },
    tenantId: tenantA,
    conversationId: convA.id,
  });
  assert.equal(result.ok, true);
});

test("claimed run_id mismatch is 403", () => {
  const result = authorizeParliamentRun({
    run: { id: "run-1", tenant_id: tenantA, conversation_id: convA.id },
    tenantId: tenantA,
    conversationId: convA.id,
    claimedRunId: "run-other",
  });
  assert.deepEqual(result, { ok: false, status: 403, error: "forbidden" });
});
