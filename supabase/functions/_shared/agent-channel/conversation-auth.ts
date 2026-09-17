export type ConversationAuthRow = {
  id: string;
  tenant_id: string;
  agent_id?: string | null;
  status?: string | null;
};

export type ConversationAuthInput = {
  conversation: ConversationAuthRow | null | undefined;
  tenantId: string;
  claimedAgentId?: string | null;
  claimedSessionTenantId?: string | null;
  claimedRunTenantId?: string | null;
  claimedRunId?: string | null;
  runId?: string | null;
};

export type ConversationAuthResult =
  | { ok: true; conversation: ConversationAuthRow }
  | { ok: false; status: 403 | 404; error: "not_found" | "forbidden" };

function sameId(left: string | null | undefined, right: string | null | undefined): boolean {
  return String(left || "").trim() === String(right || "").trim();
}

/** Cross-tenant conversation ids return 404 so callers cannot probe another tenant. */
export function authorizeConversationAction(input: ConversationAuthInput): ConversationAuthResult {
  const tenantId = String(input.tenantId || "").trim();
  const conversation = input.conversation;
  if (!tenantId || !conversation?.id) {
    return { ok: false, status: 404, error: "not_found" };
  }
  if (!sameId(conversation.tenant_id, tenantId)) {
    return { ok: false, status: 404, error: "not_found" };
  }

  const claimedAgentId = String(input.claimedAgentId || "").trim();
  if (claimedAgentId && conversation.agent_id && !sameId(conversation.agent_id, claimedAgentId)) {
    return { ok: false, status: 403, error: "forbidden" };
  }
  if (input.claimedSessionTenantId && !sameId(input.claimedSessionTenantId, tenantId)) {
    return { ok: false, status: 403, error: "forbidden" };
  }
  if (input.claimedRunTenantId && !sameId(input.claimedRunTenantId, tenantId)) {
    return { ok: false, status: 403, error: "forbidden" };
  }
  const claimedRunId = String(input.claimedRunId || "").trim();
  const runId = String(input.runId || "").trim();
  if (claimedRunId && runId && !sameId(claimedRunId, runId)) {
    return { ok: false, status: 403, error: "forbidden" };
  }
  return { ok: true, conversation };
}

export function authorizeParliamentRun(input: {
  run: { id: string; tenant_id: string; conversation_id: string } | null | undefined;
  tenantId: string;
  conversationId: string;
  claimedRunId?: string | null;
}): { ok: true; run: { id: string; tenant_id: string; conversation_id: string } } | { ok: false; status: 404 | 403; error: "not_found" | "forbidden" } {
  const tenantId = String(input.tenantId || "").trim();
  const conversationId = String(input.conversationId || "").trim();
  const run = input.run;
  if (!tenantId || !conversationId || !run?.id) {
    return { ok: false, status: 404, error: "not_found" };
  }
  if (!sameId(run.tenant_id, tenantId) || !sameId(run.conversation_id, conversationId)) {
    return { ok: false, status: 404, error: "not_found" };
  }
  const claimedRunId = String(input.claimedRunId || "").trim();
  if (claimedRunId && !sameId(claimedRunId, run.id)) {
    return { ok: false, status: 403, error: "forbidden" };
  }
  return { ok: true, run };
}
