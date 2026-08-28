import { corsHeaders } from "../_shared/cors.ts";
import { ingestChannelReply } from "../_shared/agent-channel/ingest.ts";
import { mcpBearer } from "../_shared/agent-channel/hmac.ts";
import { loadSession, serviceClient } from "../_shared/agent-channel/store.ts";
import type { CallbackPayload, ChannelProvider } from "../_shared/agent-channel/types.ts";

const SERVER_INFO = { name: "agent-channel-mcp", version: "1.0.0" };
const PROTOCOL_VERSION = "2024-11-05";

const TOOLS = [
  {
    name: "reply_to_aios_session",
    description:
      "Deliver a finished answer into the AIOS Carmen conversation that dispatched this agent. " +
      "Writes directly to the Command Center thread. Do not call ask_carmen or ask_cursor to deliver the answer.",
    inputSchema: {
      type: "object",
      properties: {
        conversation_id: { type: "string" },
        session_id: { type: "string" },
        origin: { type: "string", description: "cursor | grok | claude | chatgpt | parliament" },
        content: { type: "string", description: "Full answer to show David in Carmen's chat." },
        idempotency_key: { type: "string" },
        parliament_round: { type: "number" },
      },
      required: ["conversation_id", "content"],
    },
  },
  {
    name: "publish_aios_progress",
    description: "Post a short progress note into the AIOS conversation without closing the turn.",
    inputSchema: {
      type: "object",
      properties: {
        conversation_id: { type: "string" },
        session_id: { type: "string" },
        origin: { type: "string" },
        content: { type: "string" },
      },
      required: ["conversation_id", "content"],
    },
  },
  {
    name: "request_aios_approval",
    description:
      "Ask David to approve a write action (PR merge, deploy, prod data change). Does not execute the action.",
    inputSchema: {
      type: "object",
      properties: {
        conversation_id: { type: "string" },
        session_id: { type: "string" },
        origin: { type: "string" },
        content: { type: "string", description: "What needs approval and why." },
      },
      required: ["conversation_id", "content"],
    },
  },
];

function rpcResult(id: unknown, result: unknown) {
  return new Response(JSON.stringify({ jsonrpc: "2.0", id: id ?? null, result }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function rpcError(id: unknown, code: number, message: string, httpStatus = 200) {
  return new Response(JSON.stringify({ jsonrpc: "2.0", id: id ?? null, error: { code, message } }), {
    status: httpStatus,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function bearerFrom(req: Request): string | undefined {
  const h = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!h) return undefined;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : undefined;
}

async function handleTool(name: string, args: Record<string, any>): Promise<string> {
  const conversationId = String(args?.conversation_id ?? "").trim();
  const content = String(args?.content ?? "").trim();
  if (!conversationId || !content) throw new Error("conversation_id and content are required");

  const sb = serviceClient();
  const sessionId = String(args?.session_id ?? "").trim();
  const session = sessionId ? await loadSession(sb, sessionId) : null;
  const origin = (String(args?.origin || session?.provider || "cursor") as ChannelProvider);

  const eventType =
    name === "publish_aios_progress" ? "progress" :
    name === "request_aios_approval" ? "approval_request" : "message";

  const payload: CallbackPayload = {
    tenant_id: session?.tenant_id,
    conversation_id: conversationId,
    session_id: sessionId || undefined,
    origin,
    content,
    event_type: eventType,
    idempotency_key: args?.idempotency_key ? String(args.idempotency_key) : undefined,
    parliament_round: args?.parliament_round != null ? Number(args.parliament_round) : undefined,
  };
  const result = await ingestChannelReply(payload);
  if (result.duplicate) return "Already delivered (idempotent). No duplicate message was created.";
  if (eventType === "approval_request") return "Approval request posted to the AIOS conversation. Wait for David.";
  if (eventType === "progress") return "Progress note posted to the AIOS conversation.";
  return "Answer delivered to the AIOS Carmen conversation.";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (req.method === "GET") {
    return new Response(JSON.stringify({ ok: true, server: SERVER_INFO, tools: TOOLS.map((t) => t.name) }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let msg: any;
  try { msg = await req.json(); } catch { return rpcError(null, -32700, "Parse error"); }
  const { id, method, params } = msg ?? {};

  const gate = mcpBearer();
  if (gate && bearerFrom(req) !== gate) {
    return rpcError(id, -32001, "Unauthorized: invalid or missing bearer token", 401);
  }

  try {
    switch (method) {
      case "initialize":
        return rpcResult(id, { protocolVersion: PROTOCOL_VERSION, capabilities: { tools: {} }, serverInfo: SERVER_INFO });
      case "notifications/initialized":
      case "initialized":
        return new Response("", { status: 202, headers: corsHeaders });
      case "ping":
        return rpcResult(id, {});
      case "tools/list":
        return rpcResult(id, { tools: TOOLS });
      case "tools/call": {
        const name = params?.name as string;
        const args = (params?.arguments ?? {}) as Record<string, any>;
        try {
          const text = await handleTool(name, args);
          return rpcResult(id, { content: [{ type: "text", text }] });
        } catch (e: any) {
          return rpcResult(id, {
            content: [{ type: "text", text: `❌ ${String(e?.message ?? e)}` }],
            isError: true,
          });
        }
      }
      default:
        return rpcError(id, -32601, `Method not found: ${method}`);
    }
  } catch (e: any) {
    console.error("[agent-channel-mcp]", e?.message ?? e);
    return rpcError(id, -32603, `Internal error: ${String(e?.message ?? e)}`);
  }
});
