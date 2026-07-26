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
    logAiUsage({
      source: "aiEmbed", model: AI_EMBED_MODEL,
      tokens_in: j?.usage?.prompt_tokens ?? null,
      cost_usd: estimateOpenAICostUSD(AI_EMBED_MODEL, j?.usage?.prompt_tokens ?? 0, 0),
    });
    return j?.data?.[0]?.embedding ?? null;
  } catch {
    return null;
  }
}

/** Embed many texts in one call (order preserved). Used by the tool router to
 *  populate tool embeddings cheaply. Returns null on any failure. */
export async function aiEmbedBatch(texts: string[]): Promise<number[][] | null> {
  const key = await resolveOpenAIKey();
  if (!key || !texts?.length) return null;
  try {
    const r = await fetch(`${OPENAI_BASE}/embeddings`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: AI_EMBED_MODEL,
        input: texts.map((t) => (t || "").slice(0, 8000)),
        dimensions: 1536,
      }),
    });
    if (!r.ok) return null;
    const j = await r.json();
    logAiUsage({
      source: "aiEmbedBatch", model: AI_EMBED_MODEL,
      tokens_in: j?.usage?.prompt_tokens ?? null,
      cost_usd: estimateOpenAICostUSD(AI_EMBED_MODEL, j?.usage?.prompt_tokens ?? 0, 0),
    });
    const out: number[][] = (j?.data ?? [])
      .sort((a: any, b: any) => (a.index ?? 0) - (b.index ?? 0))
      .map((d: any) => d.embedding);
    return out.length === texts.length ? out : null;
  } catch {
    return null;
  }
}

/** Single-prompt chat completion → raw assistant string, or null. */
/* ---------- Usage metering (additive, best-effort) ----------
   Every helper logs its OpenAI usage to ai_usage_log so the Command Center
   can show consumption and fire budget alerts. Failures are swallowed —
   metering must never break the actual AI call. */

const USD_PER_M: Record<string, [number, number]> = {
  "gpt-4o-mini": [0.15, 0.6],
  "gpt-4o": [2.5, 10],
  "gpt-4.1-mini": [0.4, 1.6],
  "gpt-4.1": [2, 8],
  "text-embedding-3-small": [0.02, 0],
};

export function estimateOpenAICostUSD(model: string, tokensIn: number, tokensOut: number): number | null {
  const m = (model || "").toLowerCase();
  const price = Object.entries(USD_PER_M).find(([k]) => m.includes(k))?.[1];
  if (!price || (!tokensIn && !tokensOut)) return null;
  return +((tokensIn * price[0] + tokensOut * price[1]) / 1e6).toFixed(6);
}

export function logAiUsage(row: {
  source: string;
  model?: string | null;
  tokens_in?: number | null;
  tokens_out?: number | null;
  cost_usd?: number | null;
  tenant_id?: string | null;
  meta?: Record<string, unknown>;
}): void {
  try {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return;
    fetch(`${SUPABASE_URL}/rest/v1/ai_usage_log`, {
      method: "POST",
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(row),
    }).catch(() => {});
  } catch { /* never break the caller */ }
}

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
    const model = opts?.model || AI_CHAT_MODEL;
    logAiUsage({
      source: "aiChat", model,
      tokens_in: j?.usage?.prompt_tokens ?? null,
      tokens_out: j?.usage?.completion_tokens ?? null,
      cost_usd: estimateOpenAICostUSD(model, j?.usage?.prompt_tokens ?? 0, j?.usage?.completion_tokens ?? 0),
    });
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

// Rewrite a raw voice transcript into clean, sensible Hebrew. Whisper output
// often contains homophones / garbled words (e.g. "קרמן"→"כרמן",
// "דיבור"→"דיוור", mangled names). Fixes obvious transcription errors while
// strictly preserving the original meaning and intent. When `knownNames` is
// supplied (clients + team members), a garbled name is mapped to the closest
// real entity. Best-effort: returns the original text on any failure.
export async function aiCleanTranscript(
  text: string,
  opts?: { knownNames?: string[] },
): Promise<string> {
  const raw = (text || "").trim();
  if (raw.length < 2) return raw;
  const names = (opts?.knownNames || [])
    .map((n) => String(n || "").trim())
    .filter(Boolean)
    .slice(0, 400);
  const namesBlock = names.length
    ? `\n\nרשימת שמות אמיתיים במערכת (לקוחות וחברי צוות). אם בתמלול מופיע שם שנשמע דומה לאחד מהם אך משובש — תקן אותו לשם המדויק מהרשימה. אל תמציא שם שלא ברשימה:\n${names.join(", ")}`
    : "";
  const prompt = `אתה מתקן תמלולים של הודעות קוליות בעברית. קיבלת תמלול גולמי שעלול להכיל שגיאות תמלול, הומופונים ומילים משובשות (למשל "קרמן" במקום "כרמן", "דיבור" במקום "דיוור", שמות משובשים). שכתב אותו לטקסט הכי הגיוני, ברור ותקני — תוך שמירה מוחלטת על המשמעות והכוונה המקורית. אל תוסיף מידע, אל תענה על התוכן, אל תקצר ואל תרחיב — רק תקן שגיאות תמלול. אם הטקסט כבר תקין, החזר אותו כמו שהוא. החזר אך ורק את הטקסט המתוקן, בלי הקדמות ובלי מרכאות.${namesBlock}

תמלול גולמי:
${raw}`;
  try {
    const cleaned = await aiChat(prompt);
    const out = (cleaned || "").trim();
    // Guard against the model echoing nothing or over-expanding (>3x length).
    if (!out || out.length > raw.length * 3 + 40) return raw;
    return out;
  } catch {
    return raw;
  }
}

// Speech-to-text (OpenAI Whisper). Accepts an audio Blob/File; returns the
// transcript text or null. Defaults to Hebrew.
export async function aiTranscribe(
  audio: Blob,
  opts?: { language?: string; filename?: string; key?: string },
): Promise<string | null> {
  const key = opts?.key || await resolveOpenAIKey();
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
    // Whisper bills per audio minute ($0.006/min); duration estimated from
    // blob size (webm/ogg opus ≈ 12KB/s) since the simple response has none.
    const estMinutes = audio.size / (12 * 1024 * 60);
    logAiUsage({
      source: "aiTranscribe", model: "whisper-1",
      cost_usd: +(estMinutes * 0.006).toFixed(6),
      meta: { bytes: audio.size, estimated: true },
    });
    return (j?.text ?? "").toString().trim() || null;
  } catch {
    return null;
  }
}

// Timestamped speech-to-text (OpenAI Whisper, verbose_json). Returns per-segment
// timings so multi-channel recordings can be merged into a speaker timeline.
// Segments Whisper flags as probable non-speech are dropped — Whisper is known
// to hallucinate text on silence (e.g. a mostly-quiet mic channel).
export interface TranscriptSegment {
  start: number; // seconds within this audio file
  end: number;
  text: string;
}

export async function aiTranscribeVerbose(
  audio: Blob,
  opts?: { language?: string; filename?: string },
): Promise<{ text: string; segments: TranscriptSegment[]; duration: number } | null> {
  const key = await resolveOpenAIKey();
  if (!key) return null;
  try {
    const form = new FormData();
    form.append("file", audio, opts?.filename || "audio.ogg");
    form.append("model", "whisper-1");
    form.append("language", opts?.language || "he");
    form.append("response_format", "verbose_json");
    const r = await fetch(`${OPENAI_BASE}/audio/transcriptions`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${key}` }, // let fetch set the multipart boundary
      body: form,
    });
    if (!r.ok) return null;
    const j = await r.json();
    // deno-lint-ignore no-explicit-any
    const segments: TranscriptSegment[] = (Array.isArray(j?.segments) ? j.segments : [])
      // deno-lint-ignore no-explicit-any
      .filter((s: any) => (s?.no_speech_prob ?? 0) < 0.6 && (s?.text ?? "").trim())
      // deno-lint-ignore no-explicit-any
      .map((s: any) => ({ start: Number(s.start) || 0, end: Number(s.end) || 0, text: String(s.text).trim() }));
    return {
      text: (j?.text ?? "").toString().trim(),
      segments,
      duration: Number(j?.duration) || (segments.length ? segments[segments.length - 1].end : 0),
    };
  } catch {
    return null;
  }
}

// Vision chat (gpt-4o-mini) returning parsed JSON. Images are inlined as
// base64 data URLs. Used e.g. to read speaker name labels off meeting
// screenshots. Returns null on any failure.
export async function aiVisionJSON(
  prompt: string,
  images: Blob[],
  opts?: { model?: string },
  // deno-lint-ignore no-explicit-any
): Promise<any | null> {
  const key = await resolveOpenAIKey();
  if (!key || images.length === 0) return null;
  try {
    // deno-lint-ignore no-explicit-any
    const content: any[] = [{ type: "text", text: prompt }];
    for (const img of images) {
      const bytes = new Uint8Array(await img.arrayBuffer());
      let binary = "";
      for (let i = 0; i < bytes.length; i += 8192) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      }
      content.push({
        type: "image_url",
        image_url: { url: `data:image/jpeg;base64,${btoa(binary)}` },
      });
    }
    const r = await fetch(`${OPENAI_BASE}/chat/completions`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: opts?.model || "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [{ role: "user", content }],
      }),
    });
    if (!r.ok) {
      console.error("[vision] error", r.status, (await r.text()).slice(0, 200));
      return null;
    }
    const j = await r.json();
    const visionModel = opts?.model || "gpt-4o-mini";
    logAiUsage({
      source: "aiVisionJSON", model: visionModel,
      tokens_in: j?.usage?.prompt_tokens ?? null,
      tokens_out: j?.usage?.completion_tokens ?? null,
      cost_usd: estimateOpenAICostUSD(visionModel, j?.usage?.prompt_tokens ?? 0, j?.usage?.completion_tokens ?? 0),
    });
    return JSON.parse(j?.choices?.[0]?.message?.content ?? "null");
  } catch (e) {
    console.error("[vision] failed", e);
    return null;
  }
}

// Diarized speech-to-text (ElevenLabs Scribe v2) — separates multiple speakers
// in one audio file. Used for the system/tab channel of meeting recordings so
// remote participants get individual labels. Requires ELEVENLABS_API_KEY;
// returns null when the key is missing or the request fails (callers fall
// back to Whisper without diarization). Language is auto-detected (handles
// mixed Hebrew/English meetings).
export interface DiarizedSegment {
  start: number;
  end: number;
  speaker: string; // e.g. "speaker_0"
  text: string;
}

export async function aiDiarizeTranscribe(
  audio: Blob,
  opts?: { filename?: string },
): Promise<DiarizedSegment[] | null> {
  const key = Deno.env.get("ELEVENLABS_API_KEY");
  if (!key) return null;
  try {
    const form = new FormData();
    form.append("file", audio, opts?.filename || "audio.webm");
    form.append("model_id", "scribe_v2");
    form.append("diarize", "true");
    const r = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: { "xi-api-key": key },
      body: form,
    });
    if (!r.ok) {
      console.error("[scribe] error", r.status, (await r.text()).slice(0, 300));
      return null;
    }
    const j = await r.json();
    // deno-lint-ignore no-explicit-any
    const words: any[] = Array.isArray(j?.words) ? j.words : [];
    const segments: DiarizedSegment[] = [];
    let current: DiarizedSegment | null = null;
    for (const w of words) {
      if (w?.type === "audio_event") continue;
      const text = String(w?.text ?? "");
      if (!text) continue;
      const speaker = String(w?.speaker_id ?? "speaker_0");
      if (current && current.speaker === speaker) {
        current.text += text;
        current.end = Number(w?.end) || current.end;
      } else {
        if (current) segments.push(current);
        current = {
          start: Number(w?.start) || 0,
          end: Number(w?.end) || 0,
          speaker,
          text,
        };
      }
    }
    if (current) segments.push(current);
    const cleaned = segments
      .map((s) => ({ ...s, text: s.text.trim() }))
      .filter((s) => s.text);
    return cleaned.length > 0 ? cleaned : null;
  } catch (e) {
    console.error("[scribe] failed", e);
    return null;
  }
}

// OpenAI TTS voices usable for Carmen. 'shimmer'/'nova' read Hebrew well.
export const AI_VOICES = ["alloy", "echo", "fable", "onyx", "nova", "shimmer", "coral", "sage"] as const;

// Text-to-speech (OpenAI). Returns raw audio bytes (default opus/ogg, ideal for
// WhatsApp voice notes) or null.
export async function aiSpeak(
  text: string,
  opts?: { voice?: string; model?: string; format?: "opus" | "mp3" | "aac" | "flac" | "wav"; instructions?: string; key?: string },
): Promise<Uint8Array | null> {
  const key = opts?.key || await resolveOpenAIKey();
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
        // gpt-4o-mini-tts supports style steering (accent/tone/pacing)
        ...(opts?.instructions ? { instructions: opts.instructions } : {}),
      }),
    });
    if (!r.ok) return null;
    // gpt-4o-mini-tts ≈ $0.015/min of audio; ~1000 chars ≈ 1 spoken minute.
    logAiUsage({
      source: "aiSpeak", model: opts?.model || "gpt-4o-mini-tts",
      cost_usd: +((Math.min(text.length, 4000) / 1000) * 0.015).toFixed(6),
      meta: { chars: Math.min(text.length, 4000), estimated: true },
    });
    return new Uint8Array(await r.arrayBuffer());
  } catch {
    return null;
  }
}
