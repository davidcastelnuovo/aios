import type { BrainRoute } from "@/lib/agentChannelRouting";

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

/** Shared space shows all agent traffic; direct hides other agents' lines. */
export function filterMessagesForRoute<T extends ChatLike>(messages: T[], route: BrainRoute | null): T[] {
  if (!route || route.route_type === "parliament") return messages;
  const slug = route.slug;
  if (slug === "internal") {
    return messages.filter((m) => {
      if (m.role === "user" || m.role === "tool_call") return true;
      const key = messageSpeakerKey(m);
      return key === "carmen";
    });
  }
  return messages.filter((m) => {
    if (m.role === "user" || m.role === "tool_call") return true;
    const key = messageSpeakerKey(m);
    return key === slug;
  });
}
