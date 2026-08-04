// Recall.ai Meeting Bot API helpers (Zoom, Google Meet, Teams).
import { detectMeetingPlatform } from "./meeting-url.ts";

const BOT_NAME = "כרמן AI — מסייעת תמלול";

export function recallApiBase(): string {
  const region = Deno.env.get("RECALL_REGION") || "us-east-1";
  return `https://${region}.recall.ai/api/v1`;
}

export function recallApiKey(): string | null {
  return Deno.env.get("RECALL_API_KEY") || null;
}

export interface CreateRecallBotOpts {
  meeting_url: string;
  join_at?: string | null;
  metadata?: Record<string, string>;
}

export interface RecallBotResponse {
  id: string;
  meeting_url?: string;
  bot_name?: string;
  join_at?: string | null;
}

export async function createRecallBot(opts: CreateRecallBotOpts): Promise<RecallBotResponse> {
  const key = recallApiKey();
  if (!key) throw new Error("RECALL_API_KEY is not configured");

  const platform = detectMeetingPlatform(opts.meeting_url);
  const body: Record<string, unknown> = {
    meeting_url: opts.meeting_url,
    bot_name: BOT_NAME,
    metadata: opts.metadata ?? {},
    recording_config: {
      video_mixed_mp4: {},
      transcript: {
        provider: {
          recallai_streaming: {
            mode: "prioritize_accuracy",
            language_code: "he",
          },
        },
        diarization: {
          use_separate_streams_when_available: true,
        },
      },
    },
    automatic_leave: {
      waiting_room_timeout: 600,
      noone_joined_timeout: 900,
      everyone_left_timeout: 30,
      recording_permission_denied_timeout: 30,
    },
  };

  if (opts.join_at) body.join_at = opts.join_at;

  // Zoom meetings that require email — any address works; no real Zoom account needed.
  const zoomEmail = Deno.env.get("RECALL_ZOOM_BOT_EMAIL");
  if (platform === "zoom" && zoomEmail) {
    body.zoom = { user_email: zoomEmail };
  }

  const res = await fetch(`${recallApiBase()}/bot`, {
    method: "POST",
    headers: {
      Authorization: `Token ${key}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("[recall] create bot failed", res.status, errText.slice(0, 500));
    throw new Error(`Recall create bot failed (${res.status}): ${errText.slice(0, 200)}`);
  }

  return await res.json();
}

export async function retrieveRecallBot(botId: string): Promise<Record<string, unknown>> {
  const key = recallApiKey();
  if (!key) throw new Error("RECALL_API_KEY is not configured");

  const res = await fetch(`${recallApiBase()}/bot/${botId}`, {
    headers: { Authorization: `Token ${key}`, Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Recall retrieve bot failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  }
  return await res.json();
}

// deno-lint-ignore no-explicit-any
export function extractRecallDownloads(bot: Record<string, any>): {
  videoUrl: string | null;
  transcriptUrl: string | null;
  durationSeconds: number | null;
} {
  const recordings = Array.isArray(bot.recordings) ? bot.recordings : [];
  const rec = recordings[0];
  if (!rec) return { videoUrl: null, transcriptUrl: null, durationSeconds: null };

  const shortcuts = rec.media_shortcuts || {};
  const videoUrl = shortcuts?.video_mixed?.data?.download_url ?? null;
  const transcriptUrl = shortcuts?.transcript?.data?.download_url ?? null;

  let durationSeconds: number | null = null;
  if (rec.started_at && rec.completed_at) {
    durationSeconds = Math.max(
      1,
      Math.round((new Date(rec.completed_at).getTime() - new Date(rec.started_at).getTime()) / 1000),
    );
  }

  return { videoUrl, transcriptUrl, durationSeconds };
}

/** Convert Recall transcript JSON to our speaker-timeline text format. */
// deno-lint-ignore no-explicit-any
export function recallTranscriptToText(data: any): string {
  const participants: { id?: number; name?: string }[] = Array.isArray(data?.participants)
    ? data.participants
    : [];
  const nameById = new Map<number, string>();
  for (const p of participants) {
    if (p.id != null) nameById.set(p.id, p.name || `משתתף ${p.id}`);
  }

  // Newer schema: array of utterances with participant + words
  if (Array.isArray(data?.utterances) && data.utterances.length > 0) {
    const lines: { at: number; line: string }[] = [];
    for (const u of data.utterances) {
      const speaker = u.participant?.name || nameById.get(u.participant?.id) || "משתתף";
      const text = (u.words || []).map((w: { text?: string }) => w.text).filter(Boolean).join(" ");
      if (!text.trim()) continue;
      const rel = u.words?.[0]?.start_timestamp?.relative ?? u.start ?? 0;
      lines.push({ at: rel, line: `[${formatClock(rel)}] ${speaker}: ${text.trim()}` });
    }
    return lines
      .sort((a, b) => a.at - b.at)
      .map((l) => l.line)
      .join("\n");
  }

  // Flat words array grouped by participant
  const words: {
    text?: string;
    participant?: { id?: number; name?: string };
    start_timestamp?: { relative?: number };
  }[] = Array.isArray(data?.words) ? data.words : [];

  if (words.length === 0 && typeof data?.text === "string") return data.text;

  const segments: { at: number; speaker: string; text: string }[] = [];
  let current: { at: number; speaker: string; parts: string[] } | null = null;

  for (const w of words) {
    const speaker = w.participant?.name || nameById.get(w.participant?.id ?? -1) || "משתתף";
    const at = w.start_timestamp?.relative ?? 0;
    if (!current || current.speaker !== speaker) {
      if (current) segments.push({ at: current.at, speaker: current.speaker, text: current.parts.join(" ") });
      current = { at, speaker, parts: [w.text || ""] };
    } else {
      current.parts.push(w.text || "");
    }
  }
  if (current) segments.push({ at: current.at, speaker: current.speaker, text: current.parts.join(" ") });

  return segments
    .filter((s) => s.text.trim())
    .map((s) => `[${formatClock(s.at)}] ${s.speaker}: ${s.text.trim()}`)
    .join("\n");
}

function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Verify Recall/Svix webhook signature (workspace verification secret). */
export async function verifyRecallWebhook(rawBody: string, headers: Headers): Promise<boolean> {
  const secret = Deno.env.get("RECALL_WORKSPACE_VERIFICATION_SECRET")
    || Deno.env.get("RECALL_SVIX_WEBHOOK_SECRET");
  if (!secret) {
    console.warn("[recall] webhook secret not set — skipping verification");
    return true;
  }

  const msgId = headers.get("webhook-id") ?? headers.get("svix-id");
  const msgTimestamp = headers.get("webhook-timestamp") ?? headers.get("svix-timestamp");
  const msgSignature = headers.get("webhook-signature") ?? headers.get("svix-signature");
  if (!msgId || !msgTimestamp || !msgSignature) return false;
  if (!secret.startsWith("whsec_")) {
    console.error("[recall] invalid verification secret format");
    return false;
  }

  try {
    const base64Part = secret.slice("whsec_".length);
    const keyBytes = Uint8Array.from(atob(base64Part), (c) => c.charCodeAt(0));
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyBytes,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );

    const toSign = `${msgId}.${msgTimestamp}.${rawBody}`;
    const sig = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(toSign));
    const expected = btoa(String.fromCharCode(...new Uint8Array(sig)));

    for (const versioned of msgSignature.split(" ")) {
      const [version, signature] = versioned.split(",");
      if (version !== "v1" || !signature) continue;
      if (timingSafeEqual(signature, expected)) return true;
    }
    return false;
  } catch (e) {
    console.error("[recall] webhook verification failed", e);
    return false;
  }
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function mapRecallEventToStatus(event: string): string | null {
  switch (event) {
    case "bot.joining_call":
      return "joining";
    case "bot.in_waiting_room":
      return "waiting_room";
    case "bot.in_call_recording":
    case "bot.in_call_not_recording":
    case "bot.recording_permission_allowed":
      return "in_meeting";
    case "bot.call_ended":
    case "bot.done":
      return "processing";
    case "bot.fatal":
      return "failed";
    default:
      return null;
  }
}
