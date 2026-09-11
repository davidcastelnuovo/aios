/**
 * Codex Direct via OpenAI Chat Completions (sync) — alternative to Cursor Cloud Agents.
 * Feature-flagged: CODEX_USE_OPENAI_API=true on Staging.
 */
import { aiChat } from "../ai.ts";
import { codexApiModel, runtimeEnv } from "../carmen-brain-flags.ts";
import type { SendContext, SendResult } from "./types.ts";
import { capabilitiesForProvider } from "./logic.ts";
import { wrapDirectPrompt } from "./prompts.ts";
import { completeSession, insertMessage, logChannelAction, serviceClient, upsertRunningSession } from "./store.ts";

const MAX_PROMPT = 24_000;

function clip(text: string): string {
  return text.length > MAX_PROMPT ? text.slice(0, MAX_PROMPT) : text;
}

export async function launchCodexViaOpenAiApi(ctx: SendContext): Promise<SendResult> {
  const sb = serviceClient();
  const env = runtimeEnv();
  const model = codexApiModel(env);

  const session = await upsertRunningSession(sb, {
    tenant_id: ctx.tenantId,
    conversation_id: ctx.conversationId,
    brain_route_id: ctx.route.id,
    provider: "codex",
    status: "running",
    metadata: { path: "codex_openai_api", model },
  });

  const prompt =
    wrapDirectPrompt({ origin: "codex", userText: ctx.content, history: ctx.history }) +
    "\n\n[CODEX_API] Reply in Hebrew unless asked otherwise. Be concise. Do not call external MCP tools.";

  const answer = await aiChat(clip(prompt), { model });
  const status = answer ? "idle" : "failed";

  if (answer) {
    await insertMessage(sb, {
      tenant_id: ctx.tenantId,
      conversation_id: ctx.conversationId,
      role: "assistant",
      speaker: "codex",
      channel: "codex",
      content: answer,
      metadata: {
        origin: "codex",
        delivery_mode: "text",
        path: "codex_openai_api",
        model,
      },
    });
  }

  await completeSession(sb, session.id, status === "idle" ? "completed" : "failed");
  await logChannelAction(sb, {
    tenantId: ctx.tenantId,
    agentId: ctx.agentId,
    action: "channel_send_codex_api",
    details: {
      conversation_id: ctx.conversationId,
      session_id: session.id,
      model,
      path: "codex_openai_api",
      ok: !!answer,
    },
    status: answer ? "success" : "error",
    error: answer ? null : "OpenAI chat returned empty",
  });

  if (!answer) {
    throw new Error("Codex API path failed — no response from OpenAI. Check OPENAI_API_KEY / llm integration.");
  }

  return {
    ok: true,
    kind: "codex",
    conversation_id: ctx.conversationId,
    session_id: session.id,
    status: "idle",
    stream: false,
    accepted_message: `[Codex · OpenAI API · ${model}] ${answer.slice(0, 120)}${answer.length > 120 ? "…" : ""}`,
    external_url: null,
    capabilities: capabilitiesForProvider("codex"),
    inline_reply: answer,
  };
}
