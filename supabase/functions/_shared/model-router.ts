/**
 * Carmen Model Router — capability profiles with failover (Autonomous Goal Engine Phase 3 foundation).
 */

import { aiChat, AI_CHAT_MODEL, estimateOpenAICostUSD, resolveOpenAIKey } from "./ai.ts";

export type ModelProfile = "FAST_CHAT" | "FAST_REASON" | "DEEP_REASON";

export type ModelRouterErrorClass =
  | "rate_limit"
  | "quota_exhausted"
  | "provider_outage"
  | "auth_error"
  | "context_incompatible"
  | "unknown";

export type ModelCallResult<T = string> = {
  ok: boolean;
  data: T | null;
  provider: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number | null;
  latencyMs: number;
  errorClass?: ModelRouterErrorClass;
  failoverReason?: string;
  attempts: Array<{ model: string; error?: string }>;
};

const PROFILE_MODELS: Record<ModelProfile, string[]> = {
  FAST_CHAT: ["gpt-4o-mini", "gpt-4.1-mini"],
  FAST_REASON: ["gpt-4o-mini", "gpt-4.1-mini"],
  DEEP_REASON: ["gpt-4.1-mini", "gpt-4o-mini"],
};

function classifyHttpError(status: number, body: string): ModelRouterErrorClass {
  const lower = body.toLowerCase();
  if (status === 429 || lower.includes("rate limit")) return "rate_limit";
  if (lower.includes("quota") || lower.includes("insufficient") || lower.includes("billing") || lower.includes("credit")) {
    return "quota_exhausted";
  }
  if (status === 401 || status === 403 || lower.includes("invalid api key")) return "auth_error";
  if (status >= 500) return "provider_outage";
  if (lower.includes("context length") || lower.includes("maximum context")) return "context_incompatible";
  return "unknown";
}

async function callOpenAIChat(
  prompt: string,
  model: string,
  jsonMode: boolean,
): Promise<{ ok: true; text: string; tokensIn: number; tokensOut: number } | { ok: false; errorClass: ModelRouterErrorClass; detail: string }> {
  const resolvedKey = await resolveOpenAIKey();
  if (!resolvedKey) return { ok: false, errorClass: "auth_error", detail: "no_openai_key" };

  const body: Record<string, unknown> = {
    model,
    messages: [{ role: "user", content: prompt }],
  };
  if (jsonMode) body.response_format = { type: "json_object" };

  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${resolvedKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const raw = await r.text();
  if (!r.ok) {
    return { ok: false, errorClass: classifyHttpError(r.status, raw), detail: raw.slice(0, 500) };
  }
  try {
    const j = JSON.parse(raw);
    return {
      ok: true,
      text: j?.choices?.[0]?.message?.content ?? "",
      tokensIn: j?.usage?.prompt_tokens ?? 0,
      tokensOut: j?.usage?.completion_tokens ?? 0,
    };
  } catch {
    return { ok: false, errorClass: "unknown", detail: "parse_error" };
  }
}

export async function modelRouterChat(
  profile: ModelProfile,
  prompt: string,
  opts?: { jsonMode?: boolean },
): Promise<ModelCallResult<string>> {
  const models = PROFILE_MODELS[profile] ?? [AI_CHAT_MODEL];
  const attempts: Array<{ model: string; error?: string }> = [];
  const start = Date.now();

  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    const res = await callOpenAIChat(prompt, model, !!opts?.jsonMode);
    if (res.ok) {
      return {
        ok: true,
        data: res.text,
        provider: "openai",
        model,
        tokensIn: res.tokensIn,
        tokensOut: res.tokensOut,
        costUsd: estimateOpenAICostUSD(model, res.tokensIn, res.tokensOut),
        latencyMs: Date.now() - start,
        attempts,
      };
    }
    attempts.push({ model, error: res.detail });
    if (i < models.length - 1) continue;
    return {
      ok: false,
      data: null,
      provider: "openai",
      model,
      tokensIn: 0,
      tokensOut: 0,
      costUsd: null,
      latencyMs: Date.now() - start,
      errorClass: res.errorClass,
      failoverReason: attempts.map((a) => `${a.model}: ${a.error}`).join("; "),
      attempts,
    };
  }

  return {
    ok: false,
    data: null,
    provider: "openai",
    model: models[0],
    tokensIn: 0,
    tokensOut: 0,
    costUsd: null,
    latencyMs: Date.now() - start,
    errorClass: "unknown",
    attempts,
  };
}

export async function modelRouterJSON<T>(
  profile: ModelProfile,
  prompt: string,
): Promise<ModelCallResult<T>> {
  const res = await modelRouterChat(profile, prompt, { jsonMode: true });
  if (!res.ok || !res.data) return { ...res, data: null };
  try {
    return { ...res, data: JSON.parse(res.data) as T };
  } catch {
    return { ...res, ok: false, data: null, errorClass: "unknown" };
  }
}

/** Fallback to aiChat when router exhausts chain. */
export async function modelRouterChatOrFallback(profile: ModelProfile, prompt: string): Promise<string | null> {
  const routed = await modelRouterChat(profile, prompt);
  if (routed.ok && routed.data) return routed.data;
  return await aiChat(prompt);
}
