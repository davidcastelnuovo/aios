// manus-mcp — an MCP server that lets Carmen (and any AIOS agent) delegate tasks
// to Manus AI directly, the same way she delegates dev tasks to Claude.
//
// It speaks JSON-RPC 2.0 over HTTP (the dialect mcp-connect already uses),
// so Carmen connects to it like any other MCP server.
//
// Tools exposed:
//   - delegate_to_manus : send any task to Manus AI and get a task URL back
//   - ask_manus         : alias for delegate_to_manus (general requests)
//
// Required Supabase secret:
//   MANUS_MCP_BEARER    shared secret Carmen's MCP client must present
//
// The Manus API key is read from the tenant's "manus" integration in
// tenant_integrations (integration_type = 'manus', settings.api_key).
// This way each tenant uses their own key — no global secret needed.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const MANUS_API_URL = "https://api.manus.ai/v1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const SERVER_INFO = { name: "manus-mcp", version: "1.0.0" };
const PROTOCOL_VERSION = "2024-11-05";

const TOOLS = [
  {
    name: "delegate_to_manus",
    description:
      "Send any task to Manus AI for autonomous execution. Manus is a general-purpose AI agent " +
      "that can research, analyze data, write content, browse the web, write and run code, and more. " +
      "Use for complex multi-step tasks that require browsing, coding, or deep research. " +
      "Asynchronous: returns a task URL to track progress. " +
      "Write the task clearly and self-contained.",
    inputSchema: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: "Clear, self-contained description of the task for Manus to perform.",
        },
        context: {
          type: "string",
          description: "Optional extra context: data, links, constraints, or acceptance criteria.",
        },
      },
      required: ["prompt"],
    },
  },
  {
    name: "ask_manus",
    description:
      "Ask Manus AI to perform any general task — research, analysis, writing, data processing, " +
      "web browsing, or code execution. Same as delegate_to_manus. " +
      "Asynchronous: returns a task URL; Manus reports its work in the session.",
    inputSchema: {
      type: "object",
      properties: {
        request: {
          type: "string",
          description: "What you want Manus to do, in plain language.",
        },
        context: {
          type: "string",
          description: "Optional extra context or constraints.",
        },
      },
      required: ["request"],
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

// Resolve tenant from the MCP connection that presented this bearer token.
async function resolveContext(bearer: string | undefined): Promise<{ tenantId: string | null; agentId: string | null }> {
  const fallback = { tenantId: null, agentId: null };
  if (!bearer || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return fallback;
  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const { data } = await sb
      .from("agent_mcp_connections")
      .select("tenant_id, agent_id")
      .eq("state", "ready")
      .filter("oauth_tokens->>bearer", "eq", bearer);
    const rows = (data || []) as Array<{ tenant_id: string | null; agent_id: string | null }>;
    const tenants = Array.from(new Set(rows.map((r) => r.tenant_id).filter(Boolean)));
    if (tenants.length === 1) {
      const agents = Array.from(new Set(rows.map((r) => r.agent_id).filter(Boolean)));
      return { tenantId: tenants[0] as string, agentId: agents.length === 1 ? (agents[0] as string) : null };
    }
    return fallback;
  } catch {
    return fallback;
  }
}

// Get the Manus API key for a tenant from tenant_integrations.
async function getManusApiKey(tenantId: string | null): Promise<string> {
  // Fallback: global secret (for single-tenant setups)
  const globalKey = Deno.env.get("MANUS_API_KEY") || "";
  if (!tenantId || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    if (!globalKey) throw new Error("Manus API key לא מוגדר — הגדר אותו בהגדרות אינטגרציות");
    return globalKey;
  }
  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const { data } = await sb
      .from("tenant_integrations")
      .select("settings")
      .eq("tenant_id", tenantId)
      .eq("integration_type", "manus")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    const key = (data?.settings as any)?.api_key;
    if (typeof key === "string" && key.length > 0) return key;
  } catch { /* fall through */ }
  if (globalKey) return globalKey;
  throw new Error("Manus API key לא מוגדר — הגדר אותו בהגדרות אינטגרציות");
}

// Create a Manus task and return the task URL.
async function createManusTask(apiKey: string, prompt: string): Promise<{ task_id: string; task_url: string; share_url: string }> {
  const res = await fetch(`${MANUS_API_URL}/tasks`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt }),
  });
  const raw = await res.text();
  if (!res.ok) {
    let detail = raw.slice(0, 400);
    try { detail = JSON.parse(raw)?.error || detail; } catch { /* keep raw */ }
    throw new Error(`Manus API ${res.status}: ${detail}`);
  }
  let data: any = {};
  try { data = JSON.parse(raw); } catch { /* ignore */ }
  return {
    task_id: data?.task_id || data?.id || "—",
    task_url: data?.task_url || data?.url || "",
    share_url: data?.share_url || data?.task_url || data?.url || "",
  };
}

async function handleToolCall(
  name: string,
  args: Record<string, any>,
  ctx: { tenantId: string | null; agentId: string | null },
): Promise<string> {
  // Both tools do the same thing — delegate a task to Manus
  const prompt = String(args?.prompt ?? args?.request ?? "").trim();
  if (!prompt) throw new Error(`${name} requires a non-empty prompt/request.`);

  const context = String(args?.context ?? "").trim();
  const fullPrompt = context ? `${prompt}\n\nהקשר נוסף:\n${context}` : prompt;

  const apiKey = await getManusApiKey(ctx.tenantId);
  const result = await createManusTask(apiKey, fullPrompt);

  const taskUrl = result.share_url || result.task_url;
  return (
    `✅ משימה נשלחה ל-Manus AI בהצלחה.\n` +
    `מזהה: ${result.task_id}\n` +
    (taskUrl ? `🔗 קישור למשימה: ${taskUrl}` : "")
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Health check
  if (req.method === "GET") {
    return new Response(JSON.stringify({ ok: true, server: SERVER_INFO, tools: TOOLS.map((t) => t.name) }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let msg: any;
  try {
    msg = await req.json();
  } catch {
    return rpcError(null, -32700, "Parse error");
  }

  const { id, method, params } = msg ?? {};

  // Bearer gate — if MANUS_MCP_BEARER is set, validate it.
  const requiredBearer = Deno.env.get("MANUS_MCP_BEARER");
  if (requiredBearer && bearerFrom(req) !== requiredBearer) {
    return rpcError(id, -32001, "Unauthorized: invalid or missing bearer token", 401);
  }

  try {
    switch (method) {
      case "initialize":
        return rpcResult(id, {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: SERVER_INFO,
        });

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
          const ctx = await resolveContext(bearerFrom(req));
          const text = await handleToolCall(name, args, ctx);
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
    console.error("[manus-mcp]", e?.message ?? e);
    return rpcError(id, -32603, `Internal error: ${String(e?.message ?? e)}`);
  }
});
