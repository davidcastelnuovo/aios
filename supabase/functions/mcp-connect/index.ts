// mcp-connect — connects to a remote MCP server via JSON-RPC over HTTP and lists tools.
// Body: { tenant_id, agent_id?, name, url, transport?, bearer_token? }
// Resync: { resync_from_secret: true, tenant_id, name, connection_id? }
//   copies the matching Edge secret (e.g. Cursor → CURSOR_MCP_BEARER) onto the
//   existing row and re-probes tools. Does not print the bearer.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const PRESET_SECRETS: Record<string, string> = {
  cursor: "CURSOR_MCP_BEARER",
  grok: "GROK_MCP_BEARER",
  claude: "CLAUDE_MCP_BEARER",
  manus: "MANUS_MCP_BEARER",
};

function jsonResponse(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function secretForConnectionName(name: string): string | undefined {
  const key = PRESET_SECRETS[name.trim().toLowerCase()];
  if (!key) return undefined;
  return Deno.env.get(key) || undefined;
}

function isInternalMcpUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.hostname.endsWith(".supabase.co") && u.pathname.includes("/functions/v1/");
  } catch {
    return false;
  }
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
  const ct = resp.headers.get("content-type") ?? "";
  if (ct.includes("text/event-stream")) {
    const m = text.match(/data:\s*(\{[^\n]+\})/);
    if (m) return JSON.parse(m[1]);
  }
  return JSON.parse(text);
}

async function probe(url: string, bearer: string | undefined) {
  let tools: any[] = [];
  let state = "ready";
  let lastError: string | null = null;
  try {
    await mcpCall(url, bearer, "initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "marketing-captain", version: "1.0.0" },
    });
    const listResp = await mcpCall(url, bearer, "tools/list");
    tools = listResp?.result?.tools ?? [];
  } catch (e: any) {
    state = "failed";
    lastError = String(e?.message ?? e);
  }
  return { tools, state, lastError };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json();
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    if (body?.resync_from_secret) {
      const tenant_id = body.tenant_id as string | undefined;
      const name = (body.name as string | undefined) || "Cursor";
      const connection_id = body.connection_id as string | undefined;
      if (!tenant_id) return jsonResponse({ error: "missing tenant_id" }, 400);

      let q = supabase
        .from("agent_mcp_connections")
        .select("id, name, url, tenant_id")
        .eq("tenant_id", tenant_id);
      if (connection_id) q = q.eq("id", connection_id);
      else q = q.eq("name", name);
      const { data: rows, error: findErr } = await q.limit(5);
      if (findErr) throw findErr;
      const row = (rows || [])[0];
      if (!row) return jsonResponse({ error: "connection not found" }, 404);
      if (!isInternalMcpUrl(row.url)) {
        return jsonResponse({ error: "refusing to resync a non-internal MCP URL" }, 400);
      }

      const bearer = secretForConnectionName(row.name);
      if (!bearer) {
        return jsonResponse({
          error: `no edge secret mapped for connection name ${row.name}`,
        }, 400);
      }

      const { tools, state, lastError } = await probe(row.url, bearer);
      const { error: updErr } = await supabase
        .from("agent_mcp_connections")
        .update({
          oauth_tokens: { bearer },
          available_tools: tools,
          state,
          last_error: lastError,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id)
        .eq("tenant_id", tenant_id);
      if (updErr) throw updErr;

      return jsonResponse({
        ok: true,
        resynced: true,
        connection_id: row.id,
        name: row.name,
        state,
        tools: (tools || []).map((t: any) => t?.name).filter(Boolean),
        error: lastError,
      });
    }

    const { tenant_id, agent_id, name, url, transport = "http", bearer_token } = body;
    if (!tenant_id || !name || !url) {
      return jsonResponse({ error: "missing tenant_id/name/url" }, 400);
    }
    if (!/^https?:\/\//.test(url)) return jsonResponse({ error: "url must be http(s)" }, 400);

    const { tools, state, lastError } = await probe(url, bearer_token);

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
