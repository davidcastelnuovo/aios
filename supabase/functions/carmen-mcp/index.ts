// carmen-mcp — MCP server that lets Grok Bot (and other external agents) talk to Carmen.
//
// Grok Bot Settings → Plugins → Add custom MCP server:
//   URL: …/functions/v1/carmen-mcp/mcp   (Streamable HTTP — required by Grok Bot)
//   Header: Authorization: Bearer <CARMEN_MCP_BEARER>
//
// Legacy JSON-RPC (Carmen mcp-connect): …/functions/v1/carmen-mcp
//
// Tools:
//   - ask_carmen : question, data lookup, or action request → Carmen's text reply
//
// Required Supabase secrets:
//   CARMEN_MCP_BEARER   shared secret Grok Bot presents as Authorization: Bearer …
// Optional:
//   CARMEN_MCP_TENANT_ID   tenant for Carmen (falls back to CLAUDE_DEFAULT_TENANT_ID)
//   CARMEN_MCP_USER_ID     acting user for permissions (default David — full owner access)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import {
  compactToolsForGrok,
  grokCompatibleInitializeResult,
  handleStreamableMcpRequest,
  isStreamableMcpPath,
  wantsStreamableHttp,
  type McpRpcMessage,
} from "../_shared/mcp-streamable-http.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, accept, mcp-session-id, mcp-protocol-version",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Expose-Headers": "Mcp-Session-Id",
};

const SERVER_INFO = { name: "carmen-mcp", version: "1.1.0" };
const PROTOCOL_VERSION = "2024-11-05";
const MAX_TEXT = 32_000;
const DEFAULT_USER_ID = "ac7b2493-dcfa-47d8-80cc-b3900a406c46"; // David — full dev-escalation tier
const GROK_MCP_URL =
  "https://zvoijyneresvkadpprel.supabase.co/functions/v1/carmen-mcp/mcp";

const TOOLS = [
  {
    name: "ask_carmen",
    description:
      "Ask Carmen — the AIOS operational CEO agent (Marketing Captain / כרמן). " +
      "She has live access to clients, leads, campaigns, tasks, finances, reports, memory, and can execute actions in the system. " +
      "Use for any question about the business data, operational requests, pulse checks, client updates, or multi-step work Carmen can do herself. " +
      "Returns Carmen's reply in Hebrew (usually). Pass conversation_id from a prior call to continue the same thread. " +
      "Synchronous — waits for Carmen to finish (may take up to ~2 minutes on heavy tool use).",
    inputSchema: {
      type: "object",
      properties: {
        message: {
          type: "string",
          description: "What to ask or tell Carmen — full request in plain language (Hebrew or English).",
        },
        context: {
          type: "string",
          description: "Optional extra context from Grok Bot: files read, investigation notes, constraints.",
        },
        conversation_id: {
          type: "string",
          description: "Optional UUID from a previous ask_carmen response — continues the same Carmen conversation.",
        },
        conversation_history: {
          type: "array",
          description: "Optional prior turns [{role,user|assistant,content}] when conversation_id is not yet known.",
          items: {
            type: "object",
            properties: {
              role: { type: "string", enum: ["user", "assistant"] },
              content: { type: "string" },
            },
            required: ["role", "content"],
          },
        },
      },
      required: ["message"],
      additionalProperties: false,
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
  const m = h?.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : undefined;
}

function requiredBearer(): string {
  return Deno.env.get("CARMEN_MCP_BEARER") || "";
}

function sb() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
}

function resolveTenantId(): string | null {
  return (
    Deno.env.get("CARMEN_MCP_TENANT_ID") ||
    Deno.env.get("CLAUDE_DEFAULT_TENANT_ID") ||
    Deno.env.get("CURSOR_DEFAULT_TENANT_ID") ||
    null
  );
}

function resolveUserId(): string {
  const u = Deno.env.get("CARMEN_MCP_USER_ID") || DEFAULT_USER_ID;
  return u.trim();
}

type HistoryItem = { role: "user" | "assistant"; content: string };

function normalizeHistory(raw: unknown): HistoryItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m) => ({ role: m.role as "user" | "assistant", content: String(m.content).slice(0, 8000) }))
    .slice(-24);
}

async function invokeCarmen(opts: {
  message: string;
  tenantId: string;
  userId: string;
  context?: string;
  conversationId?: string | null;
  conversationHistory?: HistoryItem[];
}): Promise<{ output: string; conversation_id: string | null; tools_used: string[] }> {
  const body = opts.context?.trim()
    ? `${opts.message}\n\n[הקשר מ-Grok Bot]\n${opts.context.trim()}`
    : opts.message;
  const commandText =
    `[Grok Bot → Carmen]\n` +
    `You are replying to David's Grok Bot teammate (not WhatsApp). Be concise and actionable. ` +
    `Do NOT escalate back to Grok Bot for this request — you are already the handler.\n\n` +
    body.slice(0, MAX_TEXT);

  const res = await fetch(`${SUPABASE_URL}/functions/v1/run-ai-agent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({
      tenant_id: opts.tenantId,
      user_id: opts.userId,
      command_text: commandText,
      surface: "grok_bot",
      conversation_id: opts.conversationId || undefined,
      conversation_history: opts.conversationHistory?.length ? opts.conversationHistory : undefined,
    }),
  });

  const raw = await res.text();
  if (!res.ok) {
    let detail = raw.slice(0, 500);
    try {
      detail = JSON.parse(raw)?.error || JSON.parse(raw)?.message || detail;
    } catch { /* keep */ }
    throw new Error(`Carmen run-ai-agent ${res.status}: ${detail}`);
  }

  let data: any = {};
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("Carmen returned non-JSON response");
  }

  if (!data?.success && data?.error) throw new Error(String(data.error));
  const output = String(data?.output ?? "").trim();
  if (!output) throw new Error("Carmen returned an empty reply");
  return {
    output,
    conversation_id: data?.conversation_id ? String(data.conversation_id) : null,
    tools_used: Array.isArray(data?.tools_used) ? data.tools_used.map(String) : [],
  };
}

async function logDispatch(args: {
  tenantId: string;
  tool: string;
  requestText: string;
  context: string;
  conversationId: string | null;
  toolsUsed: string[];
  status: string;
  error?: string;
}): Promise<void> {
  try {
    await sb().from("carmen_mcp_dispatches").insert({
      tenant_id: args.tenantId,
      tool: args.tool,
      request_text: args.requestText,
      context: args.context || null,
      conversation_id: args.conversationId,
      tools_used: args.toolsUsed.length ? args.toolsUsed : null,
      status: args.status,
      error: args.error || null,
    });
  } catch (e) {
    console.error("[carmen-mcp] logDispatch failed:", (e as any)?.message ?? e);
  }
}

async function handleToolCall(
  name: string,
  args: Record<string, any>,
  ctx: { tenantId: string; userId: string },
): Promise<string> {
  if (name !== "ask_carmen") throw new Error(`Unknown tool: ${name}`);

  const message = String(args?.message ?? "").trim();
  if (!message) throw new Error("ask_carmen requires a non-empty 'message'.");
  const context = String(args?.context ?? "").trim();
  const conversationId = String(args?.conversation_id ?? "").trim() || null;
  const conversationHistory = normalizeHistory(args?.conversation_history);

  try {
    const result = await invokeCarmen({
      message,
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      context,
      conversationId,
      conversationHistory,
    });

    await logDispatch({
      tenantId: ctx.tenantId,
      tool: "ask_carmen",
      requestText: message,
      context,
      conversationId: result.conversation_id,
      toolsUsed: result.tools_used,
      status: "ok",
    });

    const toolsLine = result.tools_used.length
      ? `\n\n[tools_used: ${result.tools_used.join(", ")}]`
      : "";
    const convLine = result.conversation_id
      ? `\n\n[conversation_id: ${result.conversation_id}]`
      : "";
    return `${result.output}${toolsLine}${convLine}`;
  } catch (e: any) {
    const errMsg = String(e?.message ?? e);
    await logDispatch({
      tenantId: ctx.tenantId,
      tool: "ask_carmen",
      requestText: message,
      context,
      conversationId: conversationId,
      toolsUsed: [],
      status: "error",
      error: errMsg.slice(0, 1000),
    });
    throw e;
  }
}

type RpcCtx = { tenantId: string; userId: string; grokMode: boolean };

async function handleRpcMessage(msg: McpRpcMessage, ctx: RpcCtx): Promise<Response> {
  const { id, method, params } = msg ?? {};
  const clientProtocol =
    typeof (params as any)?.protocolVersion === "string" ? (params as any).protocolVersion : undefined;

  try {
    switch (method) {
      case "initialize":
        return rpcResult(
          id,
          ctx.grokMode
            ? grokCompatibleInitializeResult(clientProtocol, SERVER_INFO)
            : {
              protocolVersion: PROTOCOL_VERSION,
              capabilities: { tools: {} },
              serverInfo: SERVER_INFO,
            },
        );
      case "notifications/initialized":
      case "initialized":
        return new Response("", { status: 202, headers: corsHeaders });
      case "ping":
        return rpcResult(id, {});
      case "tools/list":
        return rpcResult(
          id,
          {
            tools: ctx.grokMode ? compactToolsForGrok(TOOLS) : TOOLS,
          },
        );
      case "tools/call": {
        const toolName = params?.name as string;
        const toolArgs = (params?.arguments ?? {}) as Record<string, any>;
        try {
          const text = await handleToolCall(toolName, toolArgs, ctx);
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
    console.error("[carmen-mcp]", e?.message ?? e);
    return rpcError(id, -32603, `Internal error: ${String(e?.message ?? e)}`);
  }
}

function authFailure(id: unknown, message: string, httpStatus = 401): Response {
  return rpcError(id, -32001, message, httpStatus);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const pathname = new URL(req.url).pathname;
  const streamable = wantsStreamableHttp(req, pathname) || isStreamableMcpPath(pathname);

  if (!streamable && req.method === "GET") {
    return new Response(
      JSON.stringify({
        ok: true,
        server: SERVER_INFO,
        tools: TOOLS.map((t) => t.name),
        streamable_http: GROK_MCP_URL,
        setup:
          "Grok Bot → Settings → Plugins → custom MCP → URL must end with /mcp + Authorization Bearer CARMEN_MCP_BEARER",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const bearer = requiredBearer();
  if (!bearer) {
    if (streamable) {
      return handleStreamableMcpRequest(req, async (msg) =>
        authFailure(msg.id, "CARMEN_MCP_BEARER secret is not configured on the server", 503));
    }
    return rpcError(null, -32002, "CARMEN_MCP_BEARER secret is not configured on the server", 503);
  }
  if (bearerFrom(req) !== bearer) {
    if (streamable) {
      return handleStreamableMcpRequest(req, async (msg) =>
        authFailure(msg.id, "Unauthorized: invalid or missing bearer token", 401));
    }
    return rpcError(null, -32001, "Unauthorized: invalid or missing bearer token", 401);
  }

  const tenantId = resolveTenantId();
  if (!tenantId) {
    if (streamable) {
      return handleStreamableMcpRequest(req, async (msg) =>
        authFailure(msg.id, "CARMEN_MCP_TENANT_ID (or CLAUDE_DEFAULT_TENANT_ID) is not configured", 503));
    }
    return rpcError(null, -32002, "CARMEN_MCP_TENANT_ID (or CLAUDE_DEFAULT_TENANT_ID) is not configured", 503);
  }

  const ctx: RpcCtx = {
    tenantId,
    userId: resolveUserId(),
    grokMode: streamable,
  };

  if (streamable) {
    return handleStreamableMcpRequest(req, (msg) => handleRpcMessage(msg, ctx));
  }

  let msg: McpRpcMessage;
  try {
    msg = await req.json();
  } catch {
    return rpcError(null, -32700, "Parse error");
  }

  return handleRpcMessage(msg, ctx);
});
