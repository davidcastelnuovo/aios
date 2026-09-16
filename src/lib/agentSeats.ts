import type { BrainRoute } from "@/lib/agentChannelRouting";
import type { TopicChat } from "@/lib/chatTopics";

export type AgentSeatKey =
  | "shared"
  | "carmen"
  | "cursor"
  | "grok"
  | "codex"
  | "claude"
  | "chatgpt"
  | "user";

export type AgentSeatDef = {
  key: AgentSeatKey;
  slug: string | null;
  label: string;
  sprite: string;
  routeType?: BrainRoute["route_type"];
};

export const AGENT_SPRITES: Record<AgentSeatKey, string> = {
  shared: "/command-center/ghost-carmen.png",
  carmen: "/command-center/ghost-carmen.png",
  cursor: "/command-center/ghost-cursor.png",
  grok: "/command-center/ghost-grok.png",
  codex: "/command-center/ghost-codex.png",
  claude: "/command-center/ghost-carmen.png",
  chatgpt: "/command-center/ghost-codex.png",
  user: "/command-center/ghost-carmen.png",
};

/** Top rail order: shared space, then direct agents. */
export const RAIL_SEAT_ORDER: AgentSeatKey[] = [
  "shared",
  "carmen",
  "cursor",
  "grok",
  "codex",
];

export function seatKeyFromRoute(route: BrainRoute | null | undefined): AgentSeatKey {
  if (!route) return "carmen";
  if (route.route_type === "parliament" || route.slug === "parliament") return "shared";
  if (route.slug === "internal") return "carmen";
  const slug = route.slug as AgentSeatKey;
  if (slug in AGENT_SPRITES) return slug;
  return "carmen";
}

export function routeForSeatKey(routes: BrainRoute[], key: AgentSeatKey): BrainRoute | undefined {
  if (key === "shared") return routes.find((r) => r.slug === "parliament" || r.route_type === "parliament");
  if (key === "carmen") return routes.find((r) => r.slug === "internal" || r.route_type === "internal");
  return routes.find((r) => r.slug === key);
}

export function messageSpeakerKey(msg: {
  role: string;
  speaker?: string | null;
  channel?: string | null;
}): AgentSeatKey {
  if (msg.role === "user") return "user";
  const raw = (msg.speaker || msg.channel || "carmen").toLowerCase();
  if (raw === "internal" || raw === "carmen" || raw === "parliament") return "carmen";
  if (raw in AGENT_SPRITES) return raw as AgentSeatKey;
  return "carmen";
}

export function spriteForMessage(msg: {
  role: string;
  speaker?: string | null;
  channel?: string | null;
}): string {
  return AGENT_SPRITES[messageSpeakerKey(msg)];
}

type ChatLike = {
  role: string;
  speaker?: string | null;
  channel?: string | null;
};

/** Normalize channel/speaker tags to a seat slug family. */
export function messageChannelKey(msg: ChatLike): string {
  const raw = String(msg.channel || msg.speaker || "").toLowerCase().trim();
  if (!raw || raw === "user") return "";
  if (raw === "internal" || raw === "carmen") return "internal";
  if (raw === "parliament" || raw === "shared") return "parliament";
  return raw;
}

function messageBelongsToRoute(msg: ChatLike, route: BrainRoute): boolean {
  const channel = messageChannelKey(msg);
  if (route.route_type === "parliament" || route.slug === "parliament") return true;

  if (route.slug === "internal" || route.route_type === "internal") {
    // Legacy untagged lines lived on Carmen; hide other direct seats.
    if (!channel) return true;
    return channel === "internal" || channel === "carmen";
  }

  // Direct seat: only that seat's traffic (including the user's lines to it).
  if (!channel) return false;
  return channel === route.slug || channel === route.provider;
}

/**
 * Shared/parliament shows all agent traffic.
 * Direct seats (and Carmen) show only that seat's thread — including user lines.
 */
export function filterMessagesForRoute<T extends ChatLike>(messages: T[], route: BrainRoute | null): T[] {
  if (!route || route.route_type === "parliament" || route.slug === "parliament") return messages;
  return messages.filter((m) => messageBelongsToRoute(m, route));
}

/** Last open chat per seat so switching Cursor ↔ Carmen does not reuse the same thread. */
export function lastConversationStorageKeyForSeat(tenantId: string, seatSlug: string): string {
  return `aios:cc-conversation:${tenantId}:${seatSlug || "cursor"}`;
}

export function conversationMatchesRoute(
  conv: Pick<TopicChat, "brain_route_id" | "routing_mode">,
  route: BrainRoute,
  routes: BrainRoute[] = [],
): boolean {
  if (conv.brain_route_id) {
    if (conv.brain_route_id === route.id) return true;
    const owned = routes.find((r) => r.id === conv.brain_route_id);
    if (owned) {
      if (route.route_type === "parliament" || route.slug === "parliament") {
        return owned.route_type === "parliament" || owned.slug === "parliament";
      }
      return owned.slug === route.slug;
    }
  }
  const mode = String(conv.routing_mode || "").toLowerCase();
  if (!mode) {
    // Untagged legacy chats belong to Carmen only.
    return route.slug === "internal" || route.route_type === "internal";
  }
  if (route.route_type === "parliament" || route.slug === "parliament") {
    return mode === "parliament" || mode === "shared";
  }
  if (route.slug === "internal" || route.route_type === "internal") {
    return mode === "internal" || mode === "carmen";
  }
  // routing_mode is stored as route_type ("direct_channel") for every direct seat —
  // without a resolvable brain_route_id we must not leak Cursor↔Grok↔Codex threads.
  if (mode === "direct_channel" || mode === route.route_type) return false;
  return mode === route.slug || mode === route.provider;
}

export function conversationsForRoute(
  items: TopicChat[],
  route: BrainRoute | null,
  routes: BrainRoute[] = [],
): TopicChat[] {
  if (!route) return items;
  return items.filter((c) => conversationMatchesRoute(c, route, routes));
}
