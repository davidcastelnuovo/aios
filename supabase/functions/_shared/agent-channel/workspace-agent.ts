/** ChatGPT Workspace / Work Mode — repo-connected agent, not the OpenAI API Carmen uses. */

export type WorkspaceProvider = "chatgpt" | "codex";

export function workspaceAgentCreds(
  provider: WorkspaceProvider,
  env: Record<string, string | undefined> = {},
): { triggerId: string; accessToken: string } {
  const chatgptTrigger = String(env.CHATGPT_WORK_AGENT_TRIGGER_ID || env.CHATGPT_WORK_AGENT_WORKFLOW_ID || "").trim();
  const chatgptToken = String(env.CHATGPT_WORK_AGENT_TOKEN || env.CHATGPT_WORK_AGENT_ACCESS_TOKEN || "").trim();
  if (provider === "codex") {
    return {
      triggerId: String(env.CODEX_WORK_AGENT_TRIGGER_ID || chatgptTrigger).trim(),
      accessToken: String(env.CODEX_WORK_AGENT_TOKEN || chatgptToken).trim(),
    };
  }
  return { triggerId: chatgptTrigger, accessToken: chatgptToken };
}

export function workspaceConversationKey(provider: WorkspaceProvider, conversationId: string): string {
  return `aios:${provider}:${conversationId}`;
}

export function missingWorkspaceMessage(provider: WorkspaceProvider): string {
  if (provider === "codex") {
    return (
      "Codex Direct צריך ChatGPT Workspace / Work Mode (עם חיבורי הריפו), " +
      "לא את מפתח ה-OpenAI של כרמן. חסרים CHATGPT_WORK_AGENT_TRIGGER_ID ו-CHATGPT_WORK_AGENT_TOKEN " +
      "(או CODEX_WORK_AGENT_*). הסוכן ב-workspace חייב לקרוא ל-reply_to_aios_session."
    );
  }
  return (
    "ChatGPT Work Agent עדיין לא מחובר. צריך סודות CHATGPT_WORK_AGENT_TRIGGER_ID ו-CHATGPT_WORK_AGENT_TOKEN, " +
    "והסוכן חייב לקרוא ל-reply_to_aios_session."
  );
}
