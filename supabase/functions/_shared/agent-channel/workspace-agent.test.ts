import assert from "node:assert/strict";
import test from "node:test";
import {
  assertWorkspaceAccessToken,
  fetchWorkspaceAgentRun,
  missingWorkspaceMessage,
  normalizeWorkspaceTriggerId,
  validateWorkspaceTriggerId,
  workspaceAgentCreds,
  triggerWorkspaceAgentRun,
  workspaceAgentRunUrl,
  workspaceAgentTriggerUrl,
  workspaceConversationKey,
} from "./workspace-agent.ts";

test("Codex reuses the ChatGPT workspace agent when no Codex-specific secrets exist", () => {
  const shared = {
    CHATGPT_WORK_AGENT_TRIGGER_ID: "agtch_shared",
    CHATGPT_WORK_AGENT_TOKEN: "tok_shared",
  };
  assert.deepEqual(workspaceAgentCreds("codex", shared), {
    triggerId: "agtch_shared",
    accessToken: "tok_shared",
  });
  assert.deepEqual(workspaceAgentCreds("chatgpt", shared), {
    triggerId: "agtch_shared",
    accessToken: "tok_shared",
  });
});

test("Codex can pin its own workspace agent without changing ChatGPT Direct", () => {
  const env = {
    CHATGPT_WORK_AGENT_TRIGGER_ID: "agtch_chat",
    CHATGPT_WORK_AGENT_TOKEN: "tok_chat",
    CODEX_WORK_AGENT_TRIGGER_ID: "agtch_codex",
    CODEX_WORK_AGENT_TOKEN: "tok_codex",
  };
  assert.equal(workspaceAgentCreds("codex", env).triggerId, "agtch_codex");
  assert.equal(workspaceAgentCreds("chatgpt", env).triggerId, "agtch_chat");
});

test("each Codex chat keeps its own workspace thread key", () => {
  assert.equal(workspaceConversationKey("codex", "c1"), "aios:codex:c1");
  assert.equal(workspaceConversationKey("chatgpt", "c1"), "aios:chatgpt:c1");
});

test("validateWorkspaceTriggerId rejects About-tab agent id", () => {
  assert.match(validateWorkspaceTriggerId("agt_6a944e6a25c881918c4c0ab") || "", /agtch_/);
  assert.equal(validateWorkspaceTriggerId("agtch_abc123"), null);
});

test("normalize trigger id and build official trigger URL", () => {
  assert.equal(normalizeWorkspaceTriggerId('"agtch_demo"'), "agtch_demo");
  assert.equal(
    workspaceAgentTriggerUrl("agtch_complaints_123"),
    "https://api.chatgpt.com/v1/workspace_agents/agtch_complaints_123/trigger",
  );
});

test("assertWorkspaceAccessToken rejects OpenAI Platform sk- keys", () => {
  assert.match(assertWorkspaceAccessToken("sk-proj-abc") || "", /Workspace Agent/);
  assert.equal(assertWorkspaceAccessToken("wstok_abc"), null);
});

test("missing Codex workspace copy says Work Mode, not Carmen OpenAI API", () => {
  assert.match(missingWorkspaceMessage("codex"), /Workspace/);
  assert.match(missingWorkspaceMessage("codex"), /Work Mode/);
  assert.match(missingWorkspaceMessage("codex"), /לא את מפתח ה-OpenAI של כרמן/);
});


test("trigger sends the complete input and run polling reports terminal failures", async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    if (String(url).endsWith("/trigger")) {
      return new Response(JSON.stringify({
        conversation_url: "https://chatgpt.com/c/demo",
        agent_trigger_run_id: "apirun_demo",
      }), { status: 202 });
    }
    return new Response(JSON.stringify({
      status: "failed",
      error: { code: "dispatch_failed" },
    }), { status: 200 });
  }) as typeof fetch;

  try {
    const input = "task\nconversation_id: conv-1\nsession_id: sess-1";
    const triggered = await triggerWorkspaceAgentRun({
      triggerId: "agtch_demo",
      accessToken: "wstok_demo",
      conversationKey: "aios:codex:conv-1",
      input,
      idempotencyKey: "idem-1",
    });
    assert.equal(triggered.ok, true);
    assert.deepEqual(JSON.parse(String(calls[0].init?.body)), {
      conversation_key: "aios:codex:conv-1",
      input,
    });

    assert.equal(
      workspaceAgentRunUrl("agtch_demo", "apirun_demo"),
      "https://api.chatgpt.com/v1/workspace_agents/agtch_demo/runs/apirun_demo",
    );
    const run = await fetchWorkspaceAgentRun({
      triggerId: "agtch_demo",
      accessToken: "wstok_demo",
      runId: "apirun_demo",
    });
    assert.deepEqual(run, {
      ok: true,
      status: 200,
      state: "failed",
      errorCode: "dispatch_failed",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
