// Shared AI helpers — OpenAI. Single place to configure the AI provider.
// The OpenAI endpoints are wire-compatible with what the gateway exposed, so
// callers keep parsing `choices[0].message.content` and `data[0].embedding`.
//
// Key resolution (in order):
//   1. The OPENAI_API_KEY edge-function secret, if set.
//   2. Fallback: the active `llm` tenant integration's settings.openai_api_key
//      (the same place run-ai-agent's resolveLLMTarget reads). This keeps voice,
//      embeddings, etc. working even when the env secret was never configured.
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const OPENAI_BASE = "https://api.openai.com/v1";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

// Lightweight default for internal tasks (summaries, extraction, classification).
export const AI_CHAT_MODEL = "gpt-4o-mini";
// 1536 dims — matches the carmen_memory_pointers.summary_embedding / agent_memory vector columns.
export const AI_EMBED_MODEL = "text-embedding-3-small";

// Cached resolved key. `undefined` = not resolved yet; `null` = resolved to "none".
let _resolvedKey: string | null | undefined = undefined;

/**
 * Resolve the OpenAI API key: env secret first, then the tenant `llm`
 * integration's stored `openai_api_key`. Cached for the lifetime of the
 * isolate so the DB is hit at most once.
 */
export async function resolveOpenAIKey(): Promise<string | null> {
  if (OPENAI_API_KEY) return OPENAI_API_KEY;
  if (_resolvedKey !== undefined) return _resolvedKey;
  _resolvedKey = null;
  try {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return _resolvedKey;
    // Pull the active llm integration(s) and use the first one that carries an
    // openai key. Single-org deployment: the key is shared across the project.
    const url = `${SUPABASE_URL}/rest/v1/tenant_integrations` +
      `?integration_type=eq.llm&is_active=eq.true&select=settings`;
    const r = await fetch(url, {
      headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
    });
    if (!r.ok) return _resolvedKey;
    const rows = await r.json();
    if (Array.isArray(rows)) {
      for (const row of rows) {
        const k = row?.settings?.openai_api_key;
        if (typeof k === "string" && k.trim()) { _resolvedKey = k.trim(); break; }
      }
    }
  } catch {
    _resolvedKey = null;
  }
  return _resolvedKey;
}

/** True when an OpenAI key is available (env secret or tenant fallback). */
export async function hasAiKey(): Promise<boolean> {
  return !!(await resolveOpenAIKey());
}

/** Embed text → 1536-dim vector, or null on any failure (best-effort). */
export async function aiEmbed(text: string): Promise<number[] | null> {
  const key = await resolveOpenAIKey();
  if (!key || !text?.trim()) return null;
  try {
    const r = await fetch(`${OPENAI_BASE}/embeddings`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: AI_EMBED_MODEL, input: text.slice(0, 8000), dimensions: 1536 }),
    });
    if (!r.ok) return null;
    const j = await r.json();
    return j?.data?.[0]?.embedding ?? null;
  } catch {
    return null;
  }
}

/** Single-prompt chat completion → raw assistant string, or null. */
export async function aiChat(prompt: string, opts?: { model?: string; jsonMode?: boolean }): Promise<string | null> {
  const key = await resolveOpenAIKey();
  if (!key) return null;
  try {
    const body: any = {
      model: opts?.model || AI_CHAT_MODEL,
      messages: [{ role: "user", content: prompt }],
    };
    if (opts?.jsonMode) body.response_format = { type: "json_object" };
    const r = await fetch(`${OPENAI_BASE}/chat/completions`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) return null;
    const j = await r.json();
    return j?.choices?.[0]?.message?.content ?? null;
  } catch {
    return null;
  }
}

/** Chat completion that returns parsed JSON (json_object mode), or null. */
export async function aiChatJSON<T = any>(prompt: string, model?: string): Promise<T | null> {
  const raw = await aiChat(prompt, { model, jsonMode: true });
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

// Speech-to-text (OpenAI Whisper). Accepts an audio Blob/File; returns the
// transcript text or null. Defaults to Hebrew.
export async function aiTranscribe(
  audio: Blob,
  opts?: { language?: string; filename?: string },
): Promise<string | null> {
  const key = await resolveOpenAIKey();
  if (!key) return null;
  try {
    const form = new FormData();
    form.append("file", audio, opts?.filename || "audio.ogg");
    form.append("model", "whisper-1");
    form.append("language", opts?.language || "he");
    const r = await fetch(`${OPENAI_BASE}/audio/transcriptions`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${key}` }, // let fetch set the multipart boundary
      body: form,
    });
    if (!r.ok) return null;
    const j = await r.json();
    return (j?.text ?? "").toString().trim() || null;
  } catch {
    return null;
  }
}

// OpenAI TTS voices usable for Carmen. 'shimmer'/'nova' read Hebrew well.
export const AI_VOICES = ["alloy", "echo", "fable", "onyx", "nova", "shimmer", "coral", "sage"] as const;

// Text-to-speech (OpenAI). Returns raw audio bytes (default opus/ogg, ideal for
// WhatsApp voice notes) or null.
export async function aiSpeak(
  text: string,
  opts?: { voice?: string; model?: string; format?: "opus" | "mp3" | "aac" | "flac" | "wav" },
): Promise<Uint8Array | null> {
  const key = await resolveOpenAIKey();
  if (!key || !text?.trim()) return null;
  try {
    const r = await fetch(`${OPENAI_BASE}/audio/speech`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: opts?.model || "gpt-4o-mini-tts",
        voice: opts?.voice || "shimmer",
        input: text.slice(0, 4000),
        response_format: opts?.format || "opus",
      }),
    });
    if (!r.ok) return null;
    return new Uint8Array(await r.arrayBuffer());
  } catch {
    return null;
  }
}
