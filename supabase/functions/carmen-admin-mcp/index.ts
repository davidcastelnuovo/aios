// carmen-admin-mcp — a small MCP server giving Carmen safe, scoped admin tools.
//
// Currently exposes `fix_campaigner_access`: attach a campaigner to a client so
// they can see its reports — but ONLY when the campaigner already belongs to the
// client's agency. The hard scope rule is enforced in the SECURITY DEFINER
// function public.carmen_fix_campaigner_access (never widens role/agency), and
// every call is written to public.claude_carmen_audit. Carmen connects to this
// like any other MCP server; tenant is resolved server-side from the bearer.
//
// Auth: Authorization: Bearer == CLAUDE_MCP_BEARER.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const SERVER_INFO = { name: "carmen-admin-mcp", version: "1.0.0" };
const PROTOCOL_VERSION = "2024-11-05";

const TOOLS = [
  {
    name: "fix_campaigner_access",
    description:
      "Give a campaigner access to a client's reports when they should see it but don't. " +
      "SAFE BY DESIGN: it only attaches the campaigner to the client if the campaigner ALREADY belongs to " +
      "that client's agency; otherwise it refuses (it never raises a role or grants out-of-scope access). " +
      "Use when a campaigner says they can't see a client that is within their agency. " +
      "Provide campaigner_id (from search_entities/campaigner) and client_id (from list_clients). " +
      "Returns a Hebrew outcome message: granted / already_assigned / refused_out_of_scope.",
    inputSchema: {
      type: "object",
      properties: {
        campaigner_id: { type: "string", description: "campaigners.id of the campaigner" },
        client_id: { type: "string", description: "clients.id of the client whose reports they should see" },
      },
      required: ["campaigner_id", "client_id"],
    },
  },
];

function rpcResult(id: unknown, result: unknown) {
  return new Response(JSON.stringify({ jsonrpc: "2.0", id: id ?? null, result }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function rpcError(id: unknown, code: number, message: string, httpStatus = 200) {
  return new Response(JSON.stringify({ jsonrpc: "2.0", id: id ?? null, error: { code, message } }), {
    status: httpStatus, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function bearerFrom(req: Request): string | undefined {
  const h = req.headers.get("authorization") || req.headers.get("Authorization");
  const m = h?.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : undefined;
}

function sb() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
}

// Resolve tenant from the caller's bearer (single ready connection → its tenant).
async function resolveTenant(bearer: string | undefined): Promise<string | null> {
  const fallback = Deno.env.get("CLAUDE_DEFAULT_TENANT_ID") || null;
  if (!bearer) return fallback;
  try {
    const { data } = await sb()
      .from("agent_mcp_connections")
      .select("tenant_id")
      .eq("state", "ready")
      .filter("oauth_tokens->>bearer", "eq", bearer);
    const tenants = Array.from(new Set((data || []).map((r: any) => r.tenant_id).filter(Boolean)));
    return tenants.length === 1 ? (tenants[0] as string) : fallback;
  } catch { return fallback; }
}

async function handleToolCall(name: string, args: Record<string, any>, tenantId: string | null): Promise<string> {
  if (name === "fix_campaigner_access") {
    if (!tenantId) throw new Error("could not resolve tenant for this request");
    const campaignerId = String(args?.campaigner_id ?? "").trim();
    const clientId = String(args?.client_id ?? "").trim();
    if (!campaignerId || !clientId) throw new Error("campaigner_id and client_id are required");
    const { data, error } = await sb().rpc("carmen_fix_campaigner_access", {
      p_campaigner_id: campaignerId, p_client_id: clientId, p_tenant: tenantId,
    });
    if (error) throw new Error(error.message);
    return (data && (data.message || JSON.stringify(data))) || "done";
  }
  throw new Error(`Unknown tool: ${name}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method === "GET") {
    return new Response(JSON.stringify({ ok: true, server: SERVER_INFO, tools: TOOLS.map((t) => t.name) }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let msg: any;
  try { msg = await req.json(); } catch { return rpcError(null, -32700, "Parse error"); }
  const { id, method, params } = msg ?? {};

  const requiredBearer = Deno.env.get("CLAUDE_MCP_BEARER");
  if (requiredBearer && bearerFrom(req) !== requiredBearer) {
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
          const tenantId = await resolveTenant(bearerFrom(req));
          const text = await handleToolCall(name, args, tenantId);
          return rpcResult(id, { content: [{ type: "text", text }] });
        } catch (e: any) {
          return rpcResult(id, { content: [{ type: "text", text: `❌ ${String(e?.message ?? e)}` }], isError: true });
        }
      }
      default:
        return rpcError(id, -32601, `Method not found: ${method}`);
    }
  } catch (e: any) {
    console.error("[carmen-admin-mcp]", e?.message ?? e);
    return rpcError(id, -32603, `Internal error: ${String(e?.message ?? e)}`);
  }
});
