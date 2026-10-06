import assert from "node:assert/strict";
import test from "node:test";
import {
  assertWorkspaceAccessToken,
  missingWorkspaceMessage,
  normalizeWorkspaceTriggerId,
  validateWorkspaceTriggerId,
  workspaceAgentCreds,
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
