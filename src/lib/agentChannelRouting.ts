export type BrainRouteType = "internal" | "direct_channel" | "parliament";
export type BrainProvider = "internal" | "cursor" | "grok" | "claude" | "chatgpt" | "parliament";
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

export const FALLBACK_BRAIN_ROUTES: BrainRoute[] = [
  { id: "fallback-internal", slug: "internal", label: "מוח פנימי · כרמן", route_type: "internal", provider: "internal" },
  { id: "fallback-cursor", slug: "cursor", label: "Cursor Direct", route_type: "direct_channel", provider: "cursor" },
  { id: "fallback-grok", slug: "grok", label: "Grok Bot Direct", route_type: "direct_channel", provider: "grok" },
  { id: "fallback-claude", slug: "claude", label: "Claude Direct", route_type: "direct_channel", provider: "claude" },
  { id: "fallback-chatgpt", slug: "chatgpt", label: "ChatGPT Work Agent", route_type: "direct_channel", provider: "chatgpt" },
  { id: "fallback-parliament", slug: "parliament", label: "פרלמנט · Cursor + Grok", route_type: "parliament", provider: "parliament" },
];

export function storageKeyForRoute(tenantId: string): string {
  return `aios:brain-route:${tenantId}`;
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
    case "parliament": return "פרלמנט";
    default: return speaker || channel || "כרמן";
  }
}

export function sendPathForRoute(route: BrainRoute | null | undefined): "internal_stream" | "channel_gateway" {
  if (!route || route.route_type === "internal" || route.slug === "internal") return "internal_stream";
  return "channel_gateway";
}

export function parliamentSeats(route: BrainRoute | null | undefined): string[] {
  const raw = route?.config?.seats;
  if (Array.isArray(raw) && raw.length) return raw.map(String);
  return ["cursor", "grok"];
}
