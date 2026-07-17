import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const REQUIRED_BEARER = Deno.env.get("AIOS_GRAPH_MCP_BEARER") || Deno.env.get("CLAUDE_MCP_BEARER") || "";
const SERVER_INFO = { name: "aios-system-graph", version: "1.0.0" };
const PROTOCOL_VERSION = "2024-11-05";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const tools = [
  {
    name: "query_system_graph",
    description: "Search the current AIOS architecture graph and return nearby code, database, Edge Function, Carmen, skin, skill, tool, and dependency nodes. Use before modifying the system to avoid duplication and identify impact.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Component, concept, file, function, table, or architecture question." },
        depth: { type: "integer", minimum: 0, maximum: 3, default: 2 },
        limit: { type: "integer", minimum: 1, maximum: 80, default: 40 },
      },
      required: ["query"],
    },
  },
  {
    name: "graph_status",
    description: "Return the active AIOS graph version, source commit, node count, edge count, and activation time.",
    inputSchema: { type: "object", properties: {} },
  },
];

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function rpcResult(id: unknown, result: unknown) {
  return response({ jsonrpc: "2.0", id: id ?? null, result });
}

function rpcError(id: unknown, code: number, message: string, status = 200) {
  return response({ jsonrpc: "2.0", id: id ?? null, error: { code, message } }, status);
}

function bearer(req: Request) {
  const match = (req.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || "";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!REQUIRED_BEARER || bearer(req) !== REQUIRED_BEARER) {
    return response({ error: "Unauthorized" }, 401);
  }
  if (req.method === "GET") return response({ ok: true, server: SERVER_INFO });
  if (req.method !== "POST") return response({ error: "Method not allowed" }, 405);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return rpcError(null, -32700, "Parse error", 400);
  }

  const { id, method, params } = body || {};
  if (method === "initialize") {
    return rpcResult(id, {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: { tools: {} },
      serverInfo: SERVER_INFO,
    });
  }
  if (method === "notifications/initialized") return new Response(null, { status: 204, headers: corsHeaders });
  if (method === "tools/list") return rpcResult(id, { tools });
  if (method !== "tools/call") return rpcError(id, -32601, "Method not found");

  const name = params?.name;
  const args = params?.arguments || {};
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  try {
    if (name === "query_system_graph") {
      const query = String(args.query || "").trim();
      if (!query) return rpcError(id, -32602, "query is required");
      const depth = Math.min(3, Math.max(0, Number(args.depth ?? 2)));
      const limit = Math.min(80, Math.max(1, Number(args.limit ?? 40)));
      const { data, error } = await sb.rpc("carmen_query_system_graph", {
        p_query: query,
        p_depth: depth,
        p_limit: limit,
      });
      if (error) throw error;
      return rpcResult(id, { content: [{ type: "text", text: JSON.stringify(data || []) }] });
    }

    if (name === "graph_status") {
      const { data, error } = await sb
        .from("aios_graph_versions")
        .select("version,commit_sha,node_count,edge_count,activated_at")
        .eq("status", "active")
        .maybeSingle();
      if (error) throw error;
      return rpcResult(id, { content: [{ type: "text", text: JSON.stringify(data || null) }] });
    }

    return rpcError(id, -32602, `Unknown tool: ${String(name)}`);
  } catch (error) {
    console.error("[system-graph-mcp]", error);
    return rpcResult(id, {
      content: [{ type: "text", text: `System graph error: ${error instanceof Error ? error.message : String(error)}` }],
      isError: true,
    });
  }
});
