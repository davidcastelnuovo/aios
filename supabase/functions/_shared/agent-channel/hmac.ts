import { hmacSha256Hex, timingSafeEqual } from "../security.ts";

const TOKEN_VERSION = "v1";

export function callbackSecret(): string {
  return (
    Deno.env.get("AGENT_CHANNEL_CALLBACK_SECRET") ||
    Deno.env.get("CURSOR_MCP_BEARER") ||
    Deno.env.get("GROK_MCP_BEARER") ||
    ""
  );
}

export function mcpBearer(): string {
  return (
    Deno.env.get("AGENT_CHANNEL_MCP_BEARER") ||
    Deno.env.get("CURSOR_MCP_BEARER") ||
    Deno.env.get("GROK_MCP_BEARER") ||
    ""
  );
}

export async function mintCallbackToken(args: {
  sessionId: string;
  conversationId: string;
  tenantId: string;
  secret?: string;
}): Promise<string> {
  const secret = args.secret ?? callbackSecret();
  if (!secret) throw new Error("Callback secret is not configured");
  return hmacSha256Hex(
    secret,
    `${TOKEN_VERSION}:${args.sessionId}:${args.conversationId}:${args.tenantId}`,
  );
}

export async function verifyCallbackToken(args: {
  token: string;
  sessionId: string;
  conversationId: string;
  tenantId: string;
  secret?: string;
}): Promise<boolean> {
  const expected = await mintCallbackToken(args);
  return timingSafeEqual(expected, args.token);
}

export function callbackCanonicalBody(payload: {
  conversation_id: string;
  session_id?: string;
  origin: string;
  content: string;
  idempotency_key?: string;
}): string {
  return JSON.stringify({
    conversation_id: payload.conversation_id,
    session_id: payload.session_id ?? "",
    origin: payload.origin,
    content: payload.content,
    idempotency_key: payload.idempotency_key ?? "",
  });
}
