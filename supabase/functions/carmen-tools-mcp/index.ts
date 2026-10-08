// carmen-tools-mcp — Carmen's own tools (clients, leads, tasks, campaigns, automations,
// finance, memory, …) as an MCP server, WITHOUT Carmen's LLM. For coding agents
// (Claude Direct routine, Cursor Direct) so they can operate AIOS like Carmen does
// without burning tokens on her brain.
//
// URL: …/functions/v1/carmen-tools-mcp/mcp   (Streamable HTTP; plain JSON-RPC on the root)
// Auth: Authorization: Bearer <CARMEN_TOOLS_MCP_BEARER>, or ?key=<same> for clients
//       that cannot send headers (claude.ai custom connectors).
// Optional ?agent=claude|cursor labels calls and approval requests.
//
// Each tools/call runs run-ai-agent's executeTool (direct_tool mode) as the configured
// user, with the same role scoping and approval gates as Carmen. Agent spawning,
// dev-escalation and self-approval tools are not exposed; external sends, deletions,
// access and money changes are queued in agent_approval_queue for David.
// See _shared/carmen-direct-tools.mjs.
//
// Required secrets: CARMEN_TOOLS_MCP_BEARER.
// Optional: CARMEN_MCP_TENANT_ID (falls back to CLAUDE_DEFAULT_TENANT_ID), CARMEN_MCP_USER_ID.
import {
  handleStreamableMcpRequest,
  isStreamableMcpPath,
  wantsStreamableHttp,
  type McpRpcMessage,
} from "../_shared/mcp-streamable-http.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, accept, mcp-session-id, mcp-protocol-version",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Expose-Headers": "Mcp-Session-Id",
};

const SERVER_INFO = { name: "carmen-tools-mcp", version: "1.0.0" };
const PROTOCOL_VERSION = "2024-11-05";
const DEFAULT_USER_ID = "ac7b2493-dcfa-47d8-80cc-b3900a406c46"; // David
const MAX_RESULT = 60_000;
const TOOLS_TTL_MS = 5 * 60_000;

type Ctx = { tenantId: string; userId: string; caller: string };

function rpcResult(id: unknown, result: unknown) {
  return new Response(
    JSON.stringify({ jsonrpc: "2.0", id: id ?? null, result }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}

function rpcError(
  id: unknown,
  code: number,
  message: string,
  httpStatus = 200,
) {
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      id: id ?? null,
      error: { code, message },
    }),
    {
      status: httpStatus,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}

function timingSafeEqual(a: string, b: string): boolean {
  if (!a || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function presentedKeys(req: Request, url: URL): string[] {
  const m = (req.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/i);
  return [m?.[1]?.trim() || "", (url.searchParams.get("key") || "").trim()];
}

async function runDirect(
  ctx: Ctx,
  direct: Record<string, unknown>,
): Promise<any> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/run-ai-agent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({
      tenant_id: ctx.tenantId,
      user_id: ctx.userId,
      direct_tool: { ...direct, caller: ctx.caller },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new Error(String(data?.error || `run-ai-agent ${res.status}`));
  return data;
}

let toolsCache: { at: number; tools: any[] } | null = null;

async function listTools(ctx: Ctx) {
  if (toolsCache && Date.now() - toolsCache.at < TOOLS_TTL_MS)
    return toolsCache.tools;
  const data = await runDirect(ctx, { action: "list" });
  const tools = (data.tools || []).map((t: any) => ({
    name: t.name,
    description:
      (t.requires_approval ? "[queued for David's approval] " : "") +
      String(t.description || ""),
    inputSchema: t.parameters || { type: "object", properties: {} },
  }));
  toolsCache = { at: Date.now(), tools };
  return tools;
}

async function handleRpc(msg: McpRpcMessage, ctx: Ctx): Promise<Response> {
  const { id, method, params } = msg ?? {};
  try {
    switch (method) {
      case "initialize":
        return rpcResult(id, {
          protocolVersion:
            typeof (params as any)?.protocolVersion === "string"
              ? (params as any).protocolVersion
              : PROTOCOL_VERSION,
          capabilities: { tools: { listChanged: false } },
          serverInfo: SERVER_INFO,
        });
      case "notifications/initialized":
      case "initialized":
        return new Response("", { status: 202, headers: corsHeaders });
      case "ping":
        return rpcResult(id, {});
      case "tools/list":
        return rpcResult(id, { tools: await listTools(ctx) });
      case "tools/call": {
        const name = String((params as any)?.name || "");
        const args = ((params as any)?.arguments ?? {}) as Record<
          string,
          unknown
        >;
        try {
          const data = await runDirect(ctx, { action: "call", name, args });
          const text = JSON.stringify(data.result ?? null).slice(0, MAX_RESULT);
          return rpcResult(id, {
            content: [{ type: "text", text }],
            isError: !!data.result?.error,
          });
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
    console.error("[carmen-tools-mcp]", e?.message ?? e);
    return rpcError(id, -32603, `Internal error: ${String(e?.message ?? e)}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });
  const url = new URL(req.url);
  const streamable =
    wantsStreamableHttp(req, url.pathname) || isStreamableMcpPath(url.pathname);

  const fail = (code: number, message: string, status: number) =>
    streamable
      ? handleStreamableMcpRequest(req, async (msg) =>
          rpcError(msg.id, code, message, status),
        )
      : rpcError(null, code, message, status);

  const secret = Deno.env.get("CARMEN_TOOLS_MCP_BEARER") || "";
  if (!secret)
    return fail(-32002, "CARMEN_TOOLS_MCP_BEARER is not configured", 503);
  if (!presentedKeys(req, url).some((k) => timingSafeEqual(k, secret)))
    return fail(-32001, "Unauthorized", 401);

  const tenantId =
    Deno.env.get("CARMEN_MCP_TENANT_ID") ||
    Deno.env.get("CLAUDE_DEFAULT_TENANT_ID") ||
    "";
  if (!tenantId)
    return fail(
      -32002,
      "CARMEN_MCP_TENANT_ID (or CLAUDE_DEFAULT_TENANT_ID) is not configured",
      503,
    );

  const ctx: Ctx = {
    tenantId,
    userId: (Deno.env.get("CARMEN_MCP_USER_ID") || DEFAULT_USER_ID).trim(),
    caller:
      (url.searchParams.get("agent") || "agent")
        .replace(/[^a-z0-9_-]/gi, "")
        .slice(0, 40) || "agent",
  };

  if (streamable)
    return handleStreamableMcpRequest(req, (msg) => handleRpc(msg, ctx));
  if (req.method === "GET") {
    return new Response(
      JSON.stringify({
        ok: true,
        server: SERVER_INFO,
        streamable_http: `${url.origin}${url.pathname.replace(/\/$/, "")}/mcp`,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
  let msg: McpRpcMessage;
  try {
    msg = await req.json();
  } catch {
    return rpcError(null, -32700, "Parse error");
  }
  return handleRpc(msg, ctx);
});
