/**
 * Feature flags for Carmen brain routing / token savings.
 * All flags are opt-in via Supabase Edge secrets (Staging first).
 */

export function runtimeEnv(): Record<string, string | undefined> {
  try {
    return Deno.env.toObject();
  } catch {
    return {};
  }
}

export function flagEnabled(env: Record<string, string | undefined>, name: string): boolean {
  const raw = String(env[name] ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

/** Prefer fixed Cursor/Codex direct chat follow-ups over spawning new Cloud Agents. */
export function lightweightBrainEnabled(env: Record<string, string | undefined> = runtimeEnv()): boolean {
  return flagEnabled(env, "CARMEN_LIGHTWEIGHT_BRAIN");
}

/** Route Codex Direct through OpenAI Chat Completions instead of Cursor Cloud Agents. */
export function codexOpenAiApiEnabled(env: Record<string, string | undefined> = runtimeEnv()): boolean {
  return flagEnabled(env, "CODEX_USE_OPENAI_API");
}

export function codexApiModel(env: Record<string, string | undefined> = runtimeEnv()): string {
  return String(env.CODEX_API_MODEL || env.CODEX_MODEL_ID || "gpt-4o-mini").trim() || "gpt-4o-mini";
}

/** Loop guard window for Command Center / direct channels. */
export const LOOP_GUARD_WINDOW_MS = 120_000;
export const LOOP_GUARD_MAX_SENDS = 8;

export type LoopGuardHit = {
  conversation_id: string;
  provider: string;
  send_count: number;
  window_ms: number;
};

const recentSends = new Map<string, number[]>();

/** In-memory sliding window — helps spot runaway direct-channel loops in logs. */
export function recordAndCheckLoopGuard(args: {
  conversationId: string;
  provider: string;
  now?: number;
}): LoopGuardHit | null {
  const now = args.now ?? Date.now();
  const key = `${args.provider}:${args.conversationId}`;
  const windowStart = now - LOOP_GUARD_WINDOW_MS;
  const prev = (recentSends.get(key) || []).filter((t) => t > windowStart);
  prev.push(now);
  recentSends.set(key, prev);

  if (prev.length >= LOOP_GUARD_MAX_SENDS) {
    return {
      conversation_id: args.conversationId,
      provider: args.provider,
      send_count: prev.length,
      window_ms: LOOP_GUARD_WINDOW_MS,
    };
  }
  return null;
}
