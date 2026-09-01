import type { ChannelProvider } from "./types.ts";

export function buildCallbackInstructions(args: {
  origin: ChannelProvider;
  conversationId: string;
  sessionId: string;
  tenantId: string;
  token: string;
  parliamentRound?: number;
  readOnly?: boolean;
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
    `User:\n${args.userText}\n`
  );
}
