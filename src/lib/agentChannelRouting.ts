export type BrainRouteType = "internal" | "direct_channel" | "parliament";
export type BrainProvider = "internal" | "cursor" | "grok" | "claude" | "chatgpt" | "codex" | "parliament";
export type ConversationChannelStatus = "idle" | "streaming" | "waiting_external" | "debating" | "error";

export type BrainRoute = {
  id: string;
  slug: string;
  label: string;
  route_type: BrainRouteType;
  provider: BrainProvider | null;
  config?: Record<string, unknown>;
  active?: boolean;
  external_url?: string | null;
  session_status?: string | null;
};

export const DEFAULT_BRAIN_SLUG = "cursor";

export const FALLBACK_BRAIN_ROUTES: BrainRoute[] = [
  { id: "fallback-cursor", slug: "cursor", label: "Cursor Direct", route_type: "direct_channel", provider: "cursor" },
  { id: "fallback-internal", slug: "internal", label: "מוח פנימי · כרמן", route_type: "internal", provider: "internal" },
  { id: "fallback-grok", slug: "grok", label: "Grok Bot Direct", route_type: "direct_channel", provider: "grok" },
  { id: "fallback-codex", slug: "codex", label: "Codex Direct", route_type: "direct_channel", provider: "codex" },
  { id: "fallback-claude", slug: "claude", label: "Claude Direct", route_type: "direct_channel", provider: "claude" },
  { id: "fallback-chatgpt", slug: "chatgpt", label: "ChatGPT Work Agent", route_type: "direct_channel", provider: "chatgpt" },
  { id: "fallback-parliament", slug: "parliament", label: "שולחן אבירים · Cursor + Grok + Codex", route_type: "parliament", provider: "parliament", config: { seats: ["cursor", "grok", "codex"], rounds: 2, chair: "carmen" } },
];

export function storageKeyForRoute(tenantId: string): string {
  return `aios:brain-route:${tenantId}`;
}

export function pickDefaultRoute(list: BrainRoute[], saved?: string | null): BrainRoute {
  if (saved) {
    const hit = list.find((r) => r.id === saved || r.slug === saved);
    if (hit) return hit;
  }
  return list.find((r) => r.slug === DEFAULT_BRAIN_SLUG) || list[0];
}

export function isInputLocked(status: ConversationChannelStatus | string | null | undefined): boolean {
  return status === "debating" || status === "waiting_external" || status === "streaming";
}

export function groupLabel(type: BrainRouteType): string {
  if (type === "internal") return "מוח פנימי";
  if (type === "direct_channel") return "ערוץ ישיר";
  return "פרלמנט";
}

export function speakerLabel(speaker?: string | null, channel?: string | null): string {
  const key = (speaker || channel || "").toLowerCase();
  switch (key) {
    case "user": return "אתה";
    case "carmen":
    case "internal": return "כרמן";
    case "cursor": return "Cursor";
    case "grok": return "Grok";
    case "claude": return "Claude";
    case "chatgpt": return "ChatGPT";
    case "codex": return "Codex";
    case "parliament": return "שולחן אבירים";
    default: return speaker || channel || "כרמן";
  }
}

export function sendPathForRoute(route: BrainRoute | null | undefined): "internal_stream" | "channel_gateway" {
  if (!route || route.route_type === "internal" || route.slug === "internal") return "internal_stream";
  return "channel_gateway";
}

export type HudStage = "table" | "direct";
export type CouncilSeatId = "carmen" | "cursor" | "grok" | "codex";

/** Round table is the picker + council. Direct 1:1 is a solo full-screen ghost. */
export function hudStage(args: {
  userStage: HudStage;
  routeType?: string | null;
  debating?: boolean;
}): HudStage {
  if (args.debating || args.routeType === "parliament") return "table";
  return args.userStage;
}

export function slugForCouncilSeat(id: CouncilSeatId): string {
  return id === "carmen" ? "internal" : id;
}

export function councilSeatFromSlug(slug?: string | null): CouncilSeatId | null {
  const key = (slug || "").toLowerCase();
  if (key === "internal" || key === "carmen") return "carmen";
  if (key === "cursor" || key === "grok" || key === "codex") return key;
  return null;
}

export function parliamentSeats(route: BrainRoute | null | undefined): string[] {
  const raw = route?.config?.seats;
  if (Array.isArray(raw) && raw.length) return raw.map(String);
  return ["cursor", "grok", "codex"];
}

export type ParliamentSeatStateUi = "waiting" | "thinking" | "replied" | "reviewing" | "failed";

export type ParliamentSeatView = {
  provider: string;
  label: string;
  state: ParliamentSeatStateUi;
  preview?: string;
  url?: string | null;
};

export type ChatLike = {
  role: string;
  content?: string;
  speaker?: string;
  channel?: string;
  tool?: string;
};

const SEAT_LABEL: Record<string, string> = {
  carmen: "כרמן",
  cursor: "Cursor",
  grok: "Grok",
  claude: "Claude",
  chatgpt: "ChatGPT",
  codex: "Codex",
};

export function deriveParliamentView(
  messages: ChatLike[],
  route: BrainRoute | null,
): {
  round: number;
  maxRounds: number;
  topic: string;
  seats: ParliamentSeatView[];
  carmenSummary: string | null;
} {
  const names = parliamentSeats(route);
  const topic = [...messages].reverse().find((m) => m.role === "user")?.content?.trim() || "";
  const joined = messages.map((m) => `${m.tool || ""} ${m.content || ""}`).join("\n");
  const round = /סבב ביקורת|round 2/i.test(joined) ? 2 : 1;
  const carmenSummary =
    [...messages].reverse().find((m) =>
      m.role === "assistant" &&
      (m.speaker === "carmen" || m.channel === "parliament") &&
      (m.content || "").includes("המלצ"),
    )?.content ||
    [...messages].reverse().find((m) =>
      m.role === "assistant" && m.speaker === "carmen" && m.channel === "parliament" && (m.content || "").length > 80,
    )?.content ||
    null;

  const seats: ParliamentSeatView[] = names.map((provider) => {
    const replies = messages.filter((m) =>
      (m.role === "assistant" || m.role === "tool_call") &&
      (m.channel === provider || m.speaker === provider),
    );
    const failed = messages.some((m) =>
      (m.channel === provider || (m.content || "").toLowerCase().includes(provider)) &&
      /נכשל|failed|timeout/i.test(`${m.content || ""} ${m.tool || ""}`),
    );
    const last = replies.filter((m) => m.role === "assistant").at(-1);
    let state: ParliamentSeatStateUi = "waiting";
    if (failed && !last) state = "failed";
    else if (round >= 2 && last) state = replies.filter((m) => m.role === "assistant").length >= 2 ? "replied" : "reviewing";
    else if (last) state = "replied";
    else if (replies.length || /נשלח ל-|parliament|חושב/i.test(joined)) state = round >= 2 ? "reviewing" : "thinking";
    return {
      provider,
      label: SEAT_LABEL[provider] || provider,
      state,
      preview: last?.content?.slice(0, 800),
    };
  });

  return { round, maxRounds: 2, topic, seats, carmenSummary };
}
