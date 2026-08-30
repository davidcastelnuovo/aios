export type BrainMode = "internal" | "direct_channel" | "parliament";
export type RouteType = BrainMode;
export type ChannelProvider = "cursor" | "grok" | "codex" | "claude" | "chatgpt" | "internal" | "parliament";
export type CloudDirectProvider = "cursor" | "grok" | "codex";
export type ConversationStatus = "idle" | "streaming" | "waiting_external" | "debating" | "error";
export type SessionStatus = "running" | "waiting" | "completed" | "failed" | "cancelled";
export type MessageRole = "user" | "assistant" | "system" | "tool";
export type MessageEventType = "message" | "progress" | "approval_request" | "system";
export type InputMode = "typed" | "realtime_voice" | "external_channel_callback";

export type AdapterCapabilities = {
  streaming_reply: boolean;
  async_reply: boolean;
  persistent_thread: boolean;
  attachments: boolean;
  tool_calls: boolean;
  callback_required: boolean;
  supports_cancel: boolean;
};

export type BrainRouteRow = {
  id: string;
  tenant_id: string;
  agent_id: string | null;
  slug: string;
  label: string;
  route_type: RouteType;
  provider: ChannelProvider | null;
  connection_id: string | null;
  config: Record<string, unknown>;
  active: boolean;
};

export type ChannelSessionRow = {
  id: string;
  tenant_id: string;
  conversation_id: string;
  brain_route_id: string | null;
  provider: ChannelProvider;
  external_session_id: string | null;
  external_run_id: string | null;
  external_url: string | null;
  conversation_key: string | null;
  status: SessionStatus;
  parliament_run_id: string | null;
  parliament_round: number | null;
  last_activity_at: string;
  metadata: Record<string, unknown>;
};

export type ConversationMessageRow = {
  id: string;
  tenant_id: string;
  conversation_id: string;
  role: MessageRole;
  speaker: string | null;
  channel: string | null;
  content: string;
  event_type: MessageEventType;
  external_message_id: string | null;
  correlation_id: string | null;
  idempotency_key: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type SendContext = {
  tenantId: string;
  userId: string;
  agentId: string;
  conversationId: string;
  route: BrainRouteRow;
  content: string;
  inputMode: InputMode;
  idempotencyKey: string;
  history: Array<{ role: string; content: string }>;
};

export type SendResult = {
  ok: true;
  kind: ChannelProvider;
  conversation_id: string;
  session_id?: string;
  run_id?: string;
  status: ConversationStatus;
  stream: boolean;
  accepted_message: string;
  external_url?: string | null;
  capabilities: AdapterCapabilities;
};

export type CallbackPayload = {
  tenant_id?: string;
  conversation_id: string;
  session_id?: string;
  origin: ChannelProvider;
  content: string;
  event_type?: MessageEventType;
  speaker?: string;
  idempotency_key?: string;
  external_message_id?: string;
  parliament_round?: number;
  metadata?: Record<string, unknown>;
};

export const DEFAULT_BRAIN_ROUTE_SEEDS: Array<{
  slug: string;
  label: string;
  route_type: RouteType;
  provider: ChannelProvider | null;
  config: Record<string, unknown>;
}> = [
  { slug: "cursor", label: "Cursor Direct", route_type: "direct_channel", provider: "cursor", config: {} },
  { slug: "internal", label: "מוח פנימי · כרמן", route_type: "internal", provider: "internal", config: {} },
  { slug: "grok", label: "Grok Bot Direct", route_type: "direct_channel", provider: "grok", config: {} },
  { slug: "codex", label: "Codex Direct", route_type: "direct_channel", provider: "codex", config: {} },
  { slug: "claude", label: "Claude Direct", route_type: "direct_channel", provider: "claude", config: {} },
  { slug: "chatgpt", label: "ChatGPT Work Agent", route_type: "direct_channel", provider: "chatgpt", config: {} },
  {
    slug: "parliament",
    label: "שולחן אבירים · Cursor + Grok + Codex",
    route_type: "parliament",
    provider: "parliament",
    config: { seats: ["cursor", "grok", "codex"], rounds: 1, chair: "carmen", tools: "read_only" },
  },
];
