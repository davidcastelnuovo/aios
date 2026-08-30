import type { CloudDirectProvider, SendContext, SendResult } from "./types.ts";
import { acceptedMessageFor, capabilitiesForProvider } from "./logic.ts";
import { grokUsesExistingWebhook } from "./cloud-errors.ts";
import { createCloudAgent, followUpCloudAgent, cursorApiKey } from "./cursor-api.ts";
import { fireGrokBotWebhook } from "./grok-webhook.ts";
import { mintCallbackToken } from "./hmac.ts";
import { buildCallbackInstructions, wrapDirectPrompt } from "./prompts.ts";
import {
  allowCreateNewCloudAgent,
  busyOpenChatMessage,
  collectOpenChatIds,
  missingOpenChatMessage,
  type OpenChatProvider,
} from "./sticky-agent.ts";
import { completeSession, logChannelAction, serviceClient, upsertRunningSession } from "./store.ts";

function runtimeEnv(): Record<string, string | undefined> {
  try {
    return Deno.env.toObject();
  } catch {
    return {};
  }
}

const MAX_TEXT = 100_000;

function clip(text: string, max = MAX_TEXT): string {
  return text.length > max ? text.slice(0, max) : text;
}

function modelIdFor(provider: CloudDirectProvider): string {
  if (provider === "grok") return Deno.env.get("GROK_MODEL_ID") || "cursor-grok-4.6-high-fast";
  if (provider === "codex") return Deno.env.get("CODEX_MODEL_ID") || Deno.env.get("CURSOR_CODEX_MODEL_ID") || "";
  return Deno.env.get("CURSOR_MODEL_ID") || "";
}

function envNameFor(provider: CloudDirectProvider): string | undefined {
  if (provider === "codex") {
    return Deno.env.get("CODEX_CLOUD_ENV_NAME") || Deno.env.get("CURSOR_CLOUD_ENV_NAME") || undefined;
  }
  if (provider === "grok") {
    return Deno.env.get("GROK_CLOUD_ENV_NAME") || Deno.env.get("CURSOR_CLOUD_ENV_NAME") || undefined;
  }
  return Deno.env.get("CURSOR_CLOUD_ENV_NAME") || undefined;
}

export async function launchCloudDirect(
  ctx: SendContext,
  provider: CloudDirectProvider,
  extraPrompt?: string,
  parliament?: { runId: string; round: number },
): Promise<SendResult> {
  const grokWebhook = grokUsesExistingWebhook(
    Deno.env.get("GROK_BOT_WEBHOOK_URL"),
    Deno.env.get("GROK_BOT_WEBHOOK_KEY"),
  );
  const apiKey = cursorApiKey();
  if (!apiKey && !(provider === "grok" && grokWebhook)) {
    throw new Error(`${provider} is not configured (set CURSOR_API_KEY).`);
  }

  const sb = serviceClient();
  const session = await upsertRunningSession(sb, {
    tenant_id: ctx.tenantId,
    conversation_id: ctx.conversationId,
    brain_route_id: ctx.route.id,
    provider,
    status: "running",
    parliament_run_id: parliament?.runId ?? null,
    parliament_round: parliament?.round ?? null,
  });

  const token = await mintCallbackToken({
    sessionId: session.id,
    conversationId: ctx.conversationId,
    tenantId: ctx.tenantId,
  });
  const prompt =
    (extraPrompt || wrapDirectPrompt({ origin: provider, userText: ctx.content, history: ctx.history })) +
    buildCallbackInstructions({
      origin: provider,
      conversationId: ctx.conversationId,
      sessionId: session.id,
      tenantId: ctx.tenantId,
      token,
      parliamentRound: parliament?.round,
      readOnly: !!parliament,
    });

  const modelId = modelIdFor(provider);
  const name = `AIOS ${provider} · ${ctx.content.slice(0, 40)}`;
  const envName = envNameFor(provider);

  let fired: { url: string; id: string; reused: boolean };
  if (provider === "grok" && grokWebhook) {
    const delivered = await fireGrokBotWebhook({
      task: ctx.content,
      context:
        prompt +
        "\nYou are Grok Bot Direct in David's Command Center. Reply to David in that chat. " +
        "Do NOT call ask_carmen. Use reply_to_aios_session or the HTTP callback above.",
    });
    fired = { id: delivered.id, url: delivered.url, reused: true };
  } else if (provider === "cursor" || provider === "codex") {
    fired = await deliverToOpenCloudChat({
      apiKey,
      sb,
      tenantId: ctx.tenantId,
      provider,
      sessionId: session.external_session_id,
      prompt: clip(prompt),
      name,
      modelId,
      envName,
    });
  } else {
    fired = await createCloudAgent({ apiKey, promptText: clip(prompt), name, modelId: modelId || undefined, envName });
  }

  const updated = await upsertRunningSession(sb, {
    tenant_id: ctx.tenantId,
    conversation_id: ctx.conversationId,
    brain_route_id: ctx.route.id,
    provider,
    external_session_id: fired.id,
    external_url: fired.url,
    status: "running",
    parliament_run_id: parliament?.runId ?? null,
    parliament_round: parliament?.round ?? null,
    metadata: { reused: fired.reused },
  });

  await logChannelAction(sb, {
    tenantId: ctx.tenantId,
    agentId: ctx.agentId,
    action: `channel_send_${provider}`,
    details: { conversation_id: ctx.conversationId, session_id: updated.id, external_url: fired.url, reused: fired.reused },
  });

  return {
    ok: true,
    kind: provider,
    conversation_id: ctx.conversationId,
    session_id: updated.id,
    status: parliament ? "debating" : "waiting_external",
    stream: false,
    accepted_message: acceptedMessageFor(provider, fired.url, { reused: fired.reused }),
    external_url: fired.url,
    capabilities: capabilitiesForProvider(provider),
  };
}

async function deliverToOpenCloudChat(args: {
  apiKey: string;
  sb: ReturnType<typeof serviceClient>;
  tenantId: string;
  provider: OpenChatProvider;
  sessionId?: string | null;
  prompt: string;
  name: string;
  modelId: string;
  envName?: string;
}): Promise<{ url: string; id: string; reused: boolean }> {
  const env = runtimeEnv();
  const candidates = await collectOpenChatIds(args.sb, {
    tenantId: args.tenantId,
    provider: args.provider,
    sessionId: args.sessionId,
    env,
  });

  for (const agentId of candidates) {
    const outcome = await followUpCloudAgent(args.apiKey, agentId, args.prompt);
    if (outcome.kind === "ok") {
      return { id: outcome.id, url: outcome.url, reused: true };
    }
    if (outcome.kind === "busy") {
      throw new Error(busyOpenChatMessage(args.provider, outcome.url));
    }
  }

  if (allowCreateNewCloudAgent(env)) {
    return await createCloudAgent({
      apiKey: args.apiKey,
      promptText: args.prompt,
      name: args.name,
      modelId: args.modelId || undefined,
      envName: args.envName,
    });
  }

  throw new Error(missingOpenChatMessage(args.provider));
}

export async function launchParliamentSeat(
  ctx: SendContext,
  provider: CloudDirectProvider,
  prompt: string,
  parliament: { runId: string; round: number },
): Promise<SendResult> {
  return launchCloudDirect(ctx, provider, prompt, parliament);
}

export async function launchClaude(ctx: SendContext, extraPrompt?: string): Promise<SendResult> {
  const routineId = Deno.env.get("CLAUDE_ROUTINE_ID") || "";
  const routineToken = Deno.env.get("CLAUDE_ROUTINE_TOKEN") || "";
  if (!routineId || !routineToken) throw new Error("Claude Direct is not configured (CLAUDE_ROUTINE_ID / CLAUDE_ROUTINE_TOKEN).");

  const sb = serviceClient();
  const session = await upsertRunningSession(sb, {
    tenant_id: ctx.tenantId,
    conversation_id: ctx.conversationId,
    brain_route_id: ctx.route.id,
    provider: "claude",
    status: "running",
  });
  const token = await mintCallbackToken({
    sessionId: session.id,
    conversationId: ctx.conversationId,
    tenantId: ctx.tenantId,
  });
  const prompt =
    (extraPrompt || wrapDirectPrompt({ origin: "claude", userText: ctx.content, history: ctx.history })) +
    buildCallbackInstructions({
      origin: "claude",
      conversationId: ctx.conversationId,
      sessionId: session.id,
      tenantId: ctx.tenantId,
      token,
    });

  const body = prompt.length > 65_536 ? prompt.slice(0, 65_536) : prompt;
  const resp = await fetch(`https://api.anthropic.com/v1/claude_code/routines/${routineId}/fire`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${routineToken}`,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": Deno.env.get("CLAUDE_ROUTINE_BETA") || "experimental-cc-routine-2026-04-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text: body }),
  });
  const raw = await resp.text();
  if (!resp.ok) {
    await completeSession(sb, session.id, "failed");
    throw new Error(`Claude routine fire ${resp.status}: ${raw.slice(0, 300)}`);
  }
  let data: any = {};
  try { data = JSON.parse(raw); } catch { /* ignore */ }
  const url = String(data?.claude_code_session_url || data?.claude_code_session_id || "");
  await upsertRunningSession(sb, {
    tenant_id: ctx.tenantId,
    conversation_id: ctx.conversationId,
    brain_route_id: ctx.route.id,
    provider: "claude",
    external_session_id: url || session.id,
    external_url: url || null,
    status: "running",
  });
  await logChannelAction(sb, {
    tenantId: ctx.tenantId,
    agentId: ctx.agentId,
    action: "channel_send_claude",
    details: { conversation_id: ctx.conversationId, session_id: session.id, external_url: url },
  });
  return {
    ok: true,
    kind: "claude",
    conversation_id: ctx.conversationId,
    session_id: session.id,
    status: "waiting_external",
    stream: false,
    accepted_message: acceptedMessageFor("claude", url),
    external_url: url || null,
    capabilities: capabilitiesForProvider("claude"),
  };
}

export async function launchChatgpt(ctx: SendContext): Promise<SendResult> {
  const triggerId = Deno.env.get("CHATGPT_WORK_AGENT_TRIGGER_ID") || Deno.env.get("CHATGPT_WORK_AGENT_WORKFLOW_ID") || "";
  const accessToken = Deno.env.get("CHATGPT_WORK_AGENT_TOKEN") || Deno.env.get("CHATGPT_WORK_AGENT_ACCESS_TOKEN") || "";
  const sb = serviceClient();
  const conversationKey = `aios:${ctx.conversationId}`;
  const session = await upsertRunningSession(sb, {
    tenant_id: ctx.tenantId,
    conversation_id: ctx.conversationId,
    brain_route_id: ctx.route.id,
    provider: "chatgpt",
    conversation_key: conversationKey,
    status: "running",
  });

  if (!triggerId || !accessToken) {
    await logChannelAction(sb, {
      tenantId: ctx.tenantId,
      agentId: ctx.agentId,
      action: "channel_send_chatgpt",
      details: { conversation_id: ctx.conversationId, configured: false },
      status: "error",
      error: "missing CHATGPT_WORK_AGENT_TRIGGER_ID / CHATGPT_WORK_AGENT_TOKEN",
    });
    return {
      ok: true,
      kind: "chatgpt",
      conversation_id: ctx.conversationId,
      session_id: session.id,
      status: "waiting_external",
      stream: false,
      accepted_message:
        "ChatGPT Work Agent עדיין לא מחובר. צריך סודות CHATGPT_WORK_AGENT_TRIGGER_ID ו-CHATGPT_WORK_AGENT_TOKEN, והסוכן חייב לקרוא ל-reply_to_aios_session.",
      external_url: null,
      capabilities: capabilitiesForProvider("chatgpt"),
    };
  }

  const token = await mintCallbackToken({
    sessionId: session.id,
    conversationId: ctx.conversationId,
    tenantId: ctx.tenantId,
  });
  const input =
    wrapDirectPrompt({ origin: "chatgpt", userText: ctx.content, history: ctx.history }) +
    buildCallbackInstructions({
      origin: "chatgpt",
      conversationId: ctx.conversationId,
      sessionId: session.id,
      tenantId: ctx.tenantId,
      token,
    });

  const resp = await fetch(`https://api.chatgpt.com/v1/workspace_agents/${encodeURIComponent(triggerId)}/trigger`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "Idempotency-Key": ctx.idempotencyKey,
      "OpenAI-Beta": "workspace_agent_runs=v1",
    },
    body: JSON.stringify({ conversation_key: conversationKey, input: clip(input, 32_000) }),
  });
  const raw = await resp.text();
  if (!resp.ok) {
    await completeSession(sb, session.id, "failed");
    throw new Error(`ChatGPT Work Agent trigger ${resp.status}: ${raw.slice(0, 300)}`);
  }
  let data: any = {};
  try { data = JSON.parse(raw); } catch { /* ignore */ }
  const runId = String(data?.agent_trigger_run_id || data?.id || "");
  const url = String(data?.url || data?.conversation_url || "");
  await upsertRunningSession(sb, {
    tenant_id: ctx.tenantId,
    conversation_id: ctx.conversationId,
    brain_route_id: ctx.route.id,
    provider: "chatgpt",
    conversation_key: conversationKey,
    external_run_id: runId || null,
    external_url: url || null,
    status: "running",
  });
  await logChannelAction(sb, {
    tenantId: ctx.tenantId,
    agentId: ctx.agentId,
    action: "channel_send_chatgpt",
    details: { conversation_id: ctx.conversationId, session_id: session.id, run_id: runId, url },
  });
  return {
    ok: true,
    kind: "chatgpt",
    conversation_id: ctx.conversationId,
    session_id: session.id,
    status: "waiting_external",
    stream: false,
    accepted_message: acceptedMessageFor("chatgpt", url),
    external_url: url || null,
    capabilities: capabilitiesForProvider("chatgpt"),
  };
}
