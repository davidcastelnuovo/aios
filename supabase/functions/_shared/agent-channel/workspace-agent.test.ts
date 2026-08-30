import assert from "node:assert/strict";
import test from "node:test";
import {
  missingWorkspaceMessage,
  workspaceAgentCreds,
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

test("missing Codex workspace copy says Work Mode, not Carmen OpenAI API", () => {
  assert.match(missingWorkspaceMessage("codex"), /Workspace/);
  assert.match(missingWorkspaceMessage("codex"), /Work Mode/);
  assert.match(missingWorkspaceMessage("codex"), /לא את מפתח ה-OpenAI של כרמן/);
});
