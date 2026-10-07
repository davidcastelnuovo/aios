import type { ChannelAttachment, ChannelProvider } from "./types.ts";

export function aiosEnvironmentLabel(): "staging" | "production" {
  const env = String(Deno.env.get("APP_ENV") || Deno.env.get("VITE_APP_ENV") || "").toLowerCase();
  return env === "staging" ? "staging" : "production";
}

export function agentChannelMcpConnectionName(env?: "staging" | "production"): string {
  return (env ?? aiosEnvironmentLabel()) === "staging"
    ? "AIOS Agent Channel — Staging"
    : "AIOS Agent Channel — Production";
}

/** Official Workspace Agent API input for Codex Direct (async trigger + MCP reply). */
export function buildCodexWorkspaceAgentInput(args: {
  userText: string;
  conversationId: string;
  sessionId: string;
  tenantId: string;
  environment?: "staging" | "production";
  parliamentRound?: number | null;
  attachments?: ChannelAttachment[];
}): string {
  const env = args.environment ?? aiosEnvironmentLabel();
  const mcp = agentChannelMcpConnectionName(env);
  const roundLine = args.parliamentRound != null
    ? `parliament_round: ${args.parliamentRound}\n`
    : "";
  return (
    `[AIOS Command Center · Codex Direct]\n\n` +
    `You are AIOS Codex Direct. Complete the user's task in the Workspace and return the complete result to AIOS.\n\n` +
    `Answer it yourself. Do not forward it to Cursor, Carmen, or another agent.\n\n` +
    `User request:\n${String(args.userText || "").trim() || "(no text — see attached files)"}` +
    `${attachmentBlock(args.attachments)}\n\n` +
    `--- AIOS DELIVERY METADATA ---\n` +
    `conversation_id: ${args.conversationId}\n` +
    `session_id: ${args.sessionId}\n` +
    `origin: codex\n` +
    `tenant_id: ${args.tenantId}\n` +
    roundLine +
    `environment: ${env}\n\n` +
    `--- REQUIRED DELIVERY ---\n` +
    `When the task is complete, call reply_to_aios_session exactly once with:\n` +
    `- conversation_id from above\n` +
    `- session_id from above\n` +
    `- origin from above\n` +
    `- tenant_id from above\n` +
    `- content containing the complete answer to the user\n` +
    `- a unique idempotency_key\n` +
    (args.parliamentRound != null ? `- parliament_round when supplied\n` : "") +
    `\nBecause this is ${env === "production" ? "Production" : "Staging"}, use only ${mcp}.\n` +
    `Do not return secrets, callback tokens, environment variables, or authentication headers.\n` +
    `Do not send the same answer to both Staging and Production MCP connections.\n`
  );
}

function attachmentBlock(attachments: ChannelAttachment[] | undefined): string {
  if (!attachments?.length) return "";
  const lines = attachments.map((a) => {
    const label = a.type === "image" ? "image" : "file";
    return `- ${label}: ${a.name} → ${a.url}`;
  });
  return `\n\nAttached files (${attachments.length}):\n${lines.join("\n")}\n`;
}

export function buildCallbackInstructions(args: {
  origin: ChannelProvider;
  conversationId: string;
  sessionId: string;
  tenantId: string;
  token: string;
  parliamentRound?: number;
  readOnly?: boolean;
  callbackIntent?: "default" | "meeting_summary";
}): string {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "https://zvoijyneresvkadpprel.supabase.co";
  const roundLine = args.parliamentRound
    ? `This is parliament round ${args.parliamentRound}. Do not open another parliament.\n`
    : "";
  const ro = args.readOnly
    ? `READ-ONLY: do not open PRs, edit production, deploy, or write data. Analysis only.\n`
    : "";
  const workspaceDelivery =
    args.origin === "codex" || args.origin === "chatgpt"
      ? `For Codex/ChatGPT Workspace: deliver via the HTTP POST below (same Supabase project that dispatched you). ` +
        `Do NOT use MCP reply_to_aios_session unless that MCP server's URL is exactly ${supabaseUrl}.\n`
      : "";
  return (
    `\n\n--- DELIVER THE ANSWER BACK TO AIOS (required) ---\n` +
    `You are talking to David through Carmen's Command Center. When you finish, ` +
    `return the full answer into the same AIOS conversation. Do NOT call ask_carmen or ask_cursor to deliver it.\n` +
    workspaceDelivery +
    roundLine +
    ro +
    `conversation_id: ${args.conversationId}\n` +
    `session_id: ${args.sessionId}\n` +
    `origin: ${args.origin}\n` +
    `tenant_id: ${args.tenantId}\n\n` +
    (args.callbackIntent === "meeting_summary"
      ? `MEETING SUMMARY: do not edit the repository, do not open a pull request, and do not add a preview URL. ` +
        `The content you send back must be only the Hebrew Markdown meeting summary.\n\n`
      : `Your answer MUST include the Vercel Preview URL for this branch and the PR (or merge) link ` +
        `so David/Carmen can verify before production publish.\n\n`) +
    `Preferred: call MCP tool reply_to_aios_session with those ids and content=<your full answer>, ` +
    `plus a one-time idempotency_key.\n\n` +
    `Fallback HTTP POST ${supabaseUrl}/functions/v1/agent-channel-callback\n` +
    `Headers:\n` +
    `  Authorization: Bearer ${args.token}\n` +
    `  Content-Type: application/json\n` +
    `  Idempotency-Key: <same key>\n` +
    `Body JSON: { "conversation_id": "${args.conversationId}", "session_id": "${args.sessionId}", ` +
    `"origin": "${args.origin}", "tenant_id": "${args.tenantId}", "content": "<full answer>" }\n`
  );
}

export function wrapDirectPrompt(args: {
  origin: ChannelProvider;
  userText: string;
  history: Array<{ role: string; content: string }>;
  attachments?: ChannelAttachment[];
}): string {
  const hist = args.history
    .slice(-12)
    .map((m) => `${m.role}: ${String(m.content || "").slice(0, 1500)}`)
    .join("\n");
  const who =
    args.origin === "cursor" ? "Cursor Direct" :
    args.origin === "grok" ? "Grok Bot Direct" :
    args.origin === "codex" ? "Codex Direct (ChatGPT Workspace)" :
    args.origin === "claude" ? "Claude Direct" :
    args.origin === "chatgpt" ? "ChatGPT Work Agent" : args.origin;
  return (
    `[AIOS Command Center · ${who}]\n` +
    `You are the selected brain for this Carmen conversation. Answer David directly.\n` +
    `Reply in the user's language. Be concrete.\n\n` +
    (hist ? `Recent thread:\n${hist}\n\n` : "") +
    `User:\n${args.userText}\n` +
    attachmentBlock(args.attachments)
  );
}
