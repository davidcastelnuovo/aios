// mcp-connect — connects to a remote MCP server via JSON-RPC over HTTP and lists tools.
// Body: { tenant_id, agent_id?, name, url, transport?, bearer_token? }
// Resync: { resync_from_secret: true, tenant_id, name, connection_id? }
//   copies the matching Edge secret (e.g. Cursor → CURSOR_MCP_BEARER) onto the
//   existing row and re-probes tools. Does not print the bearer.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import {
  isInternalMcpUrl,
  probeMcp,
  resyncInternalMcpBearer,
} from "../_shared/mcp-bearer.ts";

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

      const resynced = await resyncInternalMcpBearer(supabase, row);
      if (!resynced) {
        return jsonResponse({
          error: `no edge secret mapped for connection name ${row.name}`,
        }, 400);
      }

      return jsonResponse({
        ok: true,
        resynced: true,
        connection_id: row.id,
        name: row.name,
        state: resynced.state,
        tools: (resynced.tools || []).map((t: any) => t?.name).filter(Boolean),
        error: resynced.lastError,
      });
    }

    const { tenant_id, agent_id, name, url, transport = "http", bearer_token } = body;
    if (!tenant_id || !name || !url) {
      return jsonResponse({ error: "missing tenant_id/name/url" }, 400);
    }
    if (!/^https?:\/\//.test(url)) return jsonResponse({ error: "url must be http(s)" }, 400);

    const { tools, state, lastError } = await probeMcp(url, bearer_token);

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
