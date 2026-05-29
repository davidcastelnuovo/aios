// mcp-connect — connects to a remote MCP server via JSON-RPC over HTTP and lists tools.
// Body: { tenant_id, agent_id?, name, url, transport?, bearer_token? }
// Returns: { connection_id, state, tools[] }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function jsonResponse(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function mcpCall(url: string, bearer: string | undefined, method: string, params: any = {}) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Accept": "application/json, text/event-stream",
  };
  if (bearer) headers["Authorization"] = `Bearer ${bearer}`;
  const resp = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const text = await resp.text();
  if (!resp.ok) throw new Error(`MCP ${method} ${resp.status}: ${text.slice(0, 400)}`);
  // SSE or JSON
  const ct = resp.headers.get("content-type") ?? "";
  if (ct.includes("text/event-stream")) {
    // Parse first data: line
    const m = text.match(/data:\s*(\{[^\n]+\})/);
    if (m) return JSON.parse(m[1]);
  }
  return JSON.parse(text);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json();
    const { tenant_id, agent_id, name, url, transport = "http", bearer_token } = body;
    if (!tenant_id || !name || !url) {
      return jsonResponse({ error: "missing tenant_id/name/url" }, 400);
    }
    if (!/^https?:\/\//.test(url)) return jsonResponse({ error: "url must be http(s)" }, 400);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Probe: initialize + tools/list
    let tools: any[] = [];
    let state = "ready";
    let lastError: string | null = null;
    try {
      await mcpCall(url, bearer_token, "initialize", {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "marketing-captain", version: "1.0.0" },
      });
      const listResp = await mcpCall(url, bearer_token, "tools/list");
      tools = listResp?.result?.tools ?? [];
    } catch (e: any) {
      state = "failed";
      lastError = String(e?.message ?? e);
    }

    const { data, error } = await supabase.from("agent_mcp_connections").insert({
      tenant_id,
      agent_id: agent_id ?? null,
      name,
      url,
      transport,
      state,
      oauth_tokens: bearer_token ? { bearer: bearer_token } : null,
      available_tools: tools,
      last_error: lastError,
    }).select().single();
    if (error) throw error;

    return jsonResponse({ ok: true, connection_id: data.id, state, tools, error: lastError });
  } catch (e: any) {
    console.error("[mcp-connect]", e?.message);
    return jsonResponse({ error: String(e?.message ?? e) }, 500);
  }
});
