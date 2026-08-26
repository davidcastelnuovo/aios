// Recall.ai Meeting Bot API helpers (Zoom, Google Meet, Teams).
import { detectMeetingPlatform } from "./meeting-url.ts";

const BOT_NAME = "כרמן AI — מסייעת תמלול";
const CREDIT_PROBE_MEETING_URL = "https://zoom.us/j/99900011122";
export const RECALL_CANARY_MARKER = "נבדק עכשיו";
export const RECALL_CREDIT_CANARY_OK_MS = 3 * 60 * 60 * 1000;
export const RECALL_CREDIT_CANARY_DOWN_MS = 30 * 60 * 1000;

function envGet(name: string): string | undefined {
  try {
    return typeof Deno !== "undefined" ? Deno.env.get(name) ?? undefined : undefined;
  } catch {
    return undefined;
  }
}

export function recallRegion(): string {
  return envGet("RECALL_REGION") || "us-east-1";
}

export function recallApiBase(): string {
  return `https://${recallRegion()}.recall.ai/api/v1`;
}

export function recallApiKey(): string | null {
  return envGet("RECALL_API_KEY") || null;
}

export function recallBillingDashboardUrl(region = recallRegion()): string {
  return `https://${region}.recall.ai/dashboard/billing/usage`;
}

export function recallCreditErrorMessage(region = recallRegion()): string {
  return `נגמר הקרדיט ב-Recall — כרמן לא יכולה להצטרף לפגישות עד טעינה: ${recallBillingDashboardUrl(region)}`;
}

export class RecallApiError extends Error {
  readonly status: number;
  readonly body: string;
  constructor(status: number, body: string, message: string) {
    super(message);
    this.name = "RecallApiError";
    this.status = status;
    this.body = body;
  }
}

export function isRecallCreditHttp(status: number, body = ""): boolean {
  if (status === 402) return true;
  return /insufficient credit|insufficient_credit|credit balance|top up your/i.test(body);
}

export function isRecallCreditError(err: unknown): boolean {
  if (err instanceof RecallApiError) return isRecallCreditHttp(err.status, err.body);
  if (err instanceof Error) {
    return isRecallCreditHttp(0, err.message) || err.message.includes("נגמר הקרדיט ב-Recall") || /\(402\)/.test(err.message);
  }
  return false;
}

export function formatRecallBotHours(seconds: number): string {
  const hours = seconds / 3600;
  if (hours < 0.05) return `${Math.max(0, Math.round(seconds / 60))} דק׳`;
  if (hours < 10) return `${hours.toFixed(1)} שעות`;
  return `${Math.round(hours)} שעות`;
}

export function utcMonthRange(now = new Date()): { start: string; end: string } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return { start: start.toISOString(), end: now.toISOString() };
}

export function recallBudgetThreshold(
  usageSeconds: number,
  budgetHours: number,
): "budget_95" | "budget_80" | null {
  if (!(budgetHours > 0) || !(usageSeconds >= 0)) return null;
  const pct = (usageSeconds / 3600 / budgetHours) * 100;
  if (pct >= 95) return "budget_95";
  if (pct >= 80) return "budget_80";
  return null;
}

export interface RecallQuotaCheckRow {
  status: string;
  detail: string;
  checked_at: string;
}

export function isRecallCanaryDetail(detail: string): boolean {
  return detail.includes(RECALL_CANARY_MARKER);
}

/** Run a credit canary on first check, every 3h while ok, and every 30m while down. */
export function shouldRunRecallCreditCanary(
  recent: RecallQuotaCheckRow[],
  now = Date.now(),
): boolean {
  const last = recent.find((row) => isRecallCanaryDetail(row.detail));
  if (!last) return true;
  const age = now - Date.parse(last.checked_at);
  if (!Number.isFinite(age)) return true;
  if (last.status === "down") return age >= RECALL_CREDIT_CANARY_DOWN_MS;
  return age >= RECALL_CREDIT_CANARY_OK_MS;
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
      // Mixed audio is a small artifact we can hand to Whisper when Recall's own
      // transcript is unavailable — the mp4 is far too large for that fallback.
      audio_mixed_mp3: {},
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
  const zoomEmail = envGet("RECALL_ZOOM_BOT_EMAIL");
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
    const region = recallRegion();
    console.error("[recall] create bot failed", res.status, "region=", region, errText.slice(0, 500));
    if (isRecallCreditHttp(res.status, errText)) {
      throw new RecallApiError(res.status, errText, recallCreditErrorMessage(region));
    }
    if (res.status === 401 && errText.includes("authentication_failed")) {
      throw new RecallApiError(
        res.status,
        errText,
        `Recall API token rejected (401). בדקו ש-RECALL_API_KEY מהטאב API Keys (לא whsec_) וש-RECALL_REGION תואם לאזור בחשבון Recall (כרגע: ${region}). לאירופה: eu-central-1.`,
      );
    }
    throw new RecallApiError(
      res.status,
      errText,
      `Recall create bot failed (${res.status}): ${errText.slice(0, 200)}`,
    );
  }

  return await res.json();
}

export async function fetchRecallUsageSeconds(startIso: string, endIso: string): Promise<number | null> {
  const key = recallApiKey();
  if (!key) throw new Error("RECALL_API_KEY is not configured");

  const url = `${recallApiBase()}/billing/usage/?start=${encodeURIComponent(startIso)}&end=${encodeURIComponent(endIso)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Token ${key}`, Accept: "application/json" },
  });
  if (!res.ok) {
    throw new RecallApiError(res.status, await res.text(), `Recall usage failed (${res.status})`);
  }
  const data = await res.json() as { bot_total?: number };
  return typeof data.bot_total === "number" ? data.bot_total : null;
}

export async function deleteRecallBot(botId: string): Promise<void> {
  const key = recallApiKey();
  if (!key) throw new Error("RECALL_API_KEY is not configured");

  const res = await fetch(`${recallApiBase()}/bot/${botId}`, {
    method: "DELETE",
    headers: { Authorization: `Token ${key}`, Accept: "application/json" },
  });
  if (!res.ok && res.status !== 404) {
    throw new RecallApiError(
      res.status,
      await res.text(),
      `Recall delete bot failed (${res.status})`,
    );
  }
}

/**
 * Cheap credit probe: create a scheduled bot 14 days out, then delete it.
 * Recall returns 402 when the prepaid balance cannot create new bots.
 * Scheduled bots that never join are not billed.
 */
export async function runRecallCreditCanary(): Promise<{
  creditEmpty: boolean;
  httpStatus: number;
  detail: string;
}> {
  const key = recallApiKey();
  if (!key) throw new Error("RECALL_API_KEY is not configured");

  const joinAt = new Date(Date.now() + 14 * 86400000).toISOString();
  const res = await fetch(`${recallApiBase()}/bot`, {
    method: "POST",
    headers: {
      Authorization: `Token ${key}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      meeting_url: CREDIT_PROBE_MEETING_URL,
      bot_name: "AIOS credit-check",
      join_at: joinAt,
      metadata: { purpose: "credit_probe" },
    }),
  });
  const body = await res.text();
  if (isRecallCreditHttp(res.status, body)) {
    return { creditEmpty: true, httpStatus: res.status, detail: "הקרדיט נגמר" };
  }
  if (res.ok) {
    let botId: string | undefined;
    try {
      botId = JSON.parse(body)?.id;
    } catch {
      /* ignore */
    }
    if (botId) {
      try {
        await deleteRecallBot(botId);
      } catch (e) {
        console.error("[recall] credit canary delete failed", botId, e);
      }
    }
    return { creditEmpty: false, httpStatus: res.status, detail: "קרדיט פעיל" };
  }
  return {
    creditEmpty: false,
    httpStatus: res.status,
    detail: `לא ניתן לאמת קרדיט (HTTP ${res.status})`,
  };
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
  audioUrl: string | null;
  transcriptUrl: string | null;
  transcriptStatus: string | null;
  durationSeconds: number | null;
} {
  const empty = {
    videoUrl: null,
    audioUrl: null,
    transcriptUrl: null,
    transcriptStatus: null,
    durationSeconds: null,
  };
  const recordings = Array.isArray(bot.recordings) ? bot.recordings : [];
  const rec = recordings[0];
  if (!rec) return empty;

  const shortcuts = rec.media_shortcuts || {};
  const videoUrl = shortcuts?.video_mixed?.data?.download_url ?? null;
  const audioUrl = shortcuts?.audio_mixed?.data?.download_url ?? null;
  const transcriptUrl = shortcuts?.transcript?.data?.download_url ?? null;
  const transcriptStatus = shortcuts?.transcript?.status?.code ?? null;

  let durationSeconds: number | null = null;
  if (rec.started_at && rec.completed_at) {
    durationSeconds = Math.max(
      1,
      Math.round((new Date(rec.completed_at).getTime() - new Date(rec.started_at).getTime()) / 1000),
    );
  }

  return { videoUrl, audioUrl, transcriptUrl, transcriptStatus, durationSeconds };
}

// A pause this long inside one participant's word stream starts a new line.
const UTTERANCE_GAP_SECONDS = 3;

interface RecallWord {
  text?: string;
  start_timestamp?: { relative?: number };
}

interface RecallParticipantSegment {
  participant?: { id?: number; name?: string };
  words?: RecallWord[];
}

/**
 * Recall's v1.11 transcript download is a top-level array of per-participant
 * segments, each holding a flat `words` list. Split those words into utterances
 * on pauses so the result reads as a speaker timeline rather than one long line.
 */
function participantSegmentsToLines(
  segments: RecallParticipantSegment[],
  nameById: Map<number, string>,
): { at: number; line: string }[] {
  const lines: { at: number; line: string }[] = [];

  for (const seg of segments) {
    const speaker = seg.participant?.name
      || nameById.get(seg.participant?.id ?? -1)
      || "משתתף";
    const words = Array.isArray(seg.words) ? seg.words : [];

    let startAt: number | null = null;
    let prevAt = 0;
    let buffer: string[] = [];

    const flush = () => {
      const text = buffer.join(" ").trim();
      if (text && startAt !== null) lines.push({ at: startAt, line: `[${formatClock(startAt)}] ${speaker}: ${text}` });
      buffer = [];
      startAt = null;
    };

    for (const word of words) {
      const text = (word.text || "").trim();
      if (!text) continue;
      const at = word.start_timestamp?.relative ?? prevAt;
      if (startAt === null) startAt = at;
      else if (at - prevAt > UTTERANCE_GAP_SECONDS) {
        flush();
        startAt = at;
      }
      buffer.push(text);
      prevAt = at;
    }
    flush();
  }

  return lines;
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

  // v1.11 download schema: top-level array of { participant, words }.
  if (Array.isArray(data)) {
    return participantSegmentsToLines(data as RecallParticipantSegment[], nameById)
      .sort((a, b) => a.at - b.at)
      .map((l) => l.line)
      .join("\n");
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
