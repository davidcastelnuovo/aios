import type { AdapterCapabilities, ChannelProvider, CloudDirectProvider, ConversationStatus } from "./types.ts";

export const CLOUD_DIRECT_PROVIDERS: CloudDirectProvider[] = ["cursor", "grok", "codex"];

export function isCloudDirect(provider: string): provider is CloudDirectProvider {
  return provider === "cursor" || provider === "grok" || provider === "codex";
}

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/** Pull conversation_id from Carmen context or callback instruction blocks. */
export function extractConversationId(text: string): string | null {
  const raw = String(text || "");
  const labeled = raw.match(/conversation_id:\s*([0-9a-f-]{36})/i);
  if (labeled?.[1]) return labeled[1].toLowerCase();
  const jsonish = raw.match(/"conversation_id"\s*:\s*"([0-9a-f-]{36})"/i);
  if (jsonish?.[1]) return jsonish[1].toLowerCase();
  return null;
}

export function extractUuid(text: string): string | null {
  const m = String(text || "").match(UUID_RE);
  return m ? m[0].toLowerCase() : null;
}

export function capabilitiesForProvider(provider: ChannelProvider): AdapterCapabilities {
  switch (provider) {
    case "internal":
      return {
        streaming_reply: true,
        async_reply: false,
        persistent_thread: true,
        attachments: false,
        tool_calls: true,
        callback_required: false,
        supports_cancel: true,
      };
    case "cursor":
    case "grok":
    case "codex":
      return {
        streaming_reply: false,
        async_reply: true,
        persistent_thread: true,
        attachments: true,
        tool_calls: true,
        callback_required: true,
        supports_cancel: true,
      };
    case "claude":
    case "chatgpt":
      return {
        streaming_reply: false,
        async_reply: true,
        persistent_thread: true,
        attachments: false,
        tool_calls: true,
        callback_required: true,
        supports_cancel: false,
      };
    case "parliament":
      return {
        streaming_reply: false,
        async_reply: true,
        persistent_thread: false,
        attachments: false,
        tool_calls: false,
        callback_required: true,
        supports_cancel: true,
      };
  }
}

export function statusForKind(kind: ChannelProvider): ConversationStatus {
  if (kind === "internal") return "streaming";
  if (kind === "parliament") return "debating";
  return "waiting_external";
}

export function parliamentSeatsFromConfig(config: Record<string, unknown> | null | undefined): ChannelProvider[] {
  const raw = Array.isArray(config?.seats) ? config!.seats : ["cursor", "grok", "codex"];
  const allowed = new Set<ChannelProvider>(["cursor", "grok", "codex", "claude", "chatgpt"]);
  const seats = raw
    .map((s) => String(s) as ChannelProvider)
    .filter((s) => allowed.has(s))
    .slice(0, 4);
  return seats.length ? seats : ["cursor", "grok", "codex"];
}

export function parliamentRounds(config: Record<string, unknown> | null | undefined): number {
  const n = Number(config?.rounds ?? 1);
  if (!Number.isFinite(n)) return 1;
  return Math.min(2, Math.max(1, Math.floor(n)));
}

export type ParliamentSeatState = {
  provider: ChannelProvider;
  sessionId?: string;
  round1?: string;
  round2?: string;
  failed?: boolean;
  error?: string;
};

export type ParliamentState = {
  round: number;
  max_rounds: number;
  seats: Record<string, ParliamentSeatState>;
  status: "round1" | "round2" | "synthesizing" | "done" | "cancelled";
  topic: string;
  tools: "read_only" | "write";
};

export function recordParliamentAnswer(
  state: ParliamentState,
  provider: ChannelProvider,
  content: string,
  round: number,
): ParliamentState {
  const next: ParliamentState = {
    ...state,
    seats: { ...state.seats, [provider]: { ...(state.seats[provider] || { provider }) } },
  };
  const seat = next.seats[provider];
  if (round <= 1) seat.round1 = content;
  else seat.round2 = content;
  return next;
}

export function markParliamentFailed(
  state: ParliamentState,
  provider: ChannelProvider,
  error: string,
): ParliamentState {
  return {
    ...state,
    seats: {
      ...state.seats,
      [provider]: { ...(state.seats[provider] || { provider }), failed: true, error },
    },
  };
}

export function livingSeats(state: ParliamentState): ParliamentSeatState[] {
  return Object.values(state.seats).filter((s) => !s.failed);
}

export function canAdvanceToReview(state: ParliamentState): boolean {
  if (state.status !== "round1") return false;
  const living = livingSeats(state);
  if (!living.length) return false;
  return living.every((s) => !!s.round1 || s.failed);
}

export function canSynthesize(state: ParliamentState): boolean {
  if (state.status === "done" || state.status === "cancelled") return false;
  const living = livingSeats(state);
  if (!living.length) return false;
  if (state.max_rounds <= 1) return living.every((s) => !!s.round1 || s.failed);
  return living.every((s) => (!!s.round2 || !!s.round1 || s.failed));
}

export function otherSeatAnswers(state: ParliamentState, provider: ChannelProvider): string {
  return Object.values(state.seats)
    .filter((s) => s.provider !== provider && s.round1)
    .map((s) => `### ${s.provider}\n${s.round1}`)
    .join("\n\n");
}

export function buildReviewPrompt(state: ParliamentState, provider: ChannelProvider): string {
  const own = state.seats[provider]?.round1 || "";
  const others = otherSeatAnswers(state, provider) || "(no other answers arrived)";
  return (
    `PARLIAMENT ROUND 2 of ${state.max_rounds} — critique.\n` +
    `Topic:\n${state.topic}\n\n` +
    `Your round-1 answer:\n${own}\n\n` +
    `Other participants' round-1 answers:\n${others}\n\n` +
    `Point out mistakes, risks, and missing pieces. Be specific. Do not start another parliament. ` +
    `You are read-only: no PRs, no prod writes, no deployments.`
  );
}

export function buildSynthesisPrompt(state: ParliamentState): string {
  const blocks = Object.values(state.seats).map((s) => {
    const r1 = s.round1 ? s.round1.slice(0, 800) : "(no answer)";
    const r2 = s.round2 ? `\nCritique: ${s.round2.slice(0, 400)}` : "";
    return `${s.provider}: ${r1}${r2}`;
  });
  return (
    `You are Carmen. Synthesize a SHORT answer for David — max 3 lines, Hebrew, fun and direct.\n` +
    `Format exactly:\n` +
    `החלטה: <one line>\n` +
    `מחלוקת: <one line or "אין">\n` +
    `המשך: <one action>\n\n` +
    `Topic: ${state.topic}\n\n${blocks.join("\n\n")}`
  );
}

export function acceptedMessageFor(
  kind: ChannelProvider,
  url?: string | null,
  opts?: { reused?: boolean },
): string {
  switch (kind) {
    case "internal":
      return "כרמן חושבת…";
    case "cursor":
      if (opts?.reused) {
        return url
          ? `נשלח לצ'אט Cursor שכבר פתוח. מעקב: ${url}`
          : "נשלח לצ'אט Cursor שכבר פתוח. מחכה לתשובה בשיחה הזו.";
      }
      return url ? `נשלח ל-Cursor Direct. מעקב: ${url}` : "נשלח ל-Cursor Direct. מחכה לתשובה בשיחה הזו.";
    case "grok":
      return url ? `נשלח ל-Grok Bot Direct. מעקב: ${url}` : "נשלח ל-Grok Bot Direct. מחכה לתשובה בשיחה הזו.";
    case "codex":
      if (opts?.reused) {
        return url
          ? `נשלח לצ'אט Codex שכבר פתוח. מעקב: ${url}`
          : "נשלח לצ'אט Codex שכבר פתוח. מחכה לתשובה בשיחה הזו.";
      }
      return url ? `נשלח ל-Codex Direct. מעקב: ${url}` : "נשלח ל-Codex Direct. מחכה לתשובה בשיחה הזו.";
    case "claude":
      return url ? `נשלח ל-Claude Direct. מעקב: ${url}` : "נשלח ל-Claude Direct. מחכה לתשובה בשיחה הזו.";
    case "chatgpt":
      return url ? `נשלח ל-ChatGPT Work Agent. מעקב: ${url}` : "נשלח ל-ChatGPT Work Agent. מחכה לתשובה בשיחה הזו.";
    case "parliament":
      return "שואלים את הצוות ⚡ מחכים לתשובות…";
  }
}

export function speakerForOrigin(origin: ChannelProvider): string {
  if (origin === "internal") return "carmen";
  return origin;
}

const CALLBACK_ORIGINS = new Set<ChannelProvider>([
  "cursor", "grok", "codex", "claude", "chatgpt", "internal", "parliament",
]);

/** Workspace agents often reply with origin chatgpt; the session provider is authoritative. */
export function resolveCallbackOrigin(
  stated: string | null | undefined,
  sessionProvider: string | null | undefined,
): ChannelProvider {
  const session = sessionProvider && CALLBACK_ORIGINS.has(sessionProvider as ChannelProvider)
    ? sessionProvider as ChannelProvider
    : null;
  const raw = stated && CALLBACK_ORIGINS.has(stated as ChannelProvider) ? stated as ChannelProvider : null;
  if (session && raw && raw !== session && (raw === "chatgpt" || raw === "codex") && (session === "chatgpt" || session === "codex")) {
    return session;
  }
  return raw || session || "internal";
}
