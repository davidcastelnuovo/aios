// manus-mcp — an MCP server that lets Carmen (and any AIOS agent) talk to
// Manus AI directly, the same way David asks Manus for things.
//
// It speaks JSON-RPC 2.0 over HTTP (same dialect as claude-mcp), so Carmen
// connects to it like any other MCP server. Each tools/call fires a real
// Manus task via the Manus API and returns the task URL + share URL.
// Manus then works autonomously (with GitHub, Supabase, and all connectors)
// and can notify David via manus-notify when finished.
//
// Tools exposed:
//   - ask_manus        : any general request (research, analysis, writing, planning, code)
//   - request_dev_task : code/feature/bugfix work → Manus implements + opens a PR
//
// Required Supabase secrets:
//   MANUS_MCP_BEARER   shared secret Carmen's MCP client must present
// Optional:
//   MANUS_DEFAULT_TENANT_ID  fallback tenant when one can't be resolved from the bearer
//
// The Manus API key is read from tenant_integrations (integration_type='manus').

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const MANUS_API_URL = "https://api.manus.ai/v1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const SERVER_INFO = { name: "manus-mcp", version: "2.0.0" };
const PROTOCOL_VERSION = "2024-11-05";

// ─── MCP Tools ───────────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: "ask_manus",
    description:
      "Send any task or question to Manus AI (David's autonomous agent). " +
      "Manus has access to GitHub, Supabase, web browsing, code execution, and all connectors. " +
      "Use for research, analysis, writing, planning, investigation, data work, or anything that " +
      "requires autonomous multi-step execution. Asynchronous: returns a task URL to track progress. " +
      "Manus will notify David on WhatsApp when finished.",
    inputSchema: {
      type: "object",
      properties: {
        request: {
          type: "string",
          description: "What you want Manus to do, in plain language. Be clear and self-contained.",
        },
        context: {
          type: "string",
          description: "Optional extra context: links, file paths, data, constraints, acceptance criteria.",
        },
        agent_profile: {
          type: "string",
          description: "Optional Manus agent profile. Defaults to 'manus-1.6'. Options: manus-1.6, manus-lite, manus-max.",
        },
      },
      required: ["request"],
    },
  },
  {
    name: "request_dev_task",
    description:
      "Send a software-development task to Manus (David's coding agent). " +
      "Manus reads the AIOS repository (davidcastelnuovo/aios), implements the change, and opens a pull request — " +
      "exactly the way David asks Manus to fix a bug or build a feature. " +
      "Use for bug fixes, new features, refactors, edge-function changes, migrations, or config work. " +
      "Asynchronous: returns a task URL; the PR appears once Manus finishes.",
    inputSchema: {
      type: "object",
      properties: {
        task: {
          type: "string",
          description: "Clear, self-contained description of the development work to perform.",
        },
        branch: {
          type: "string",
          description: "Optional target/base branch. If omitted Manus uses main.",
        },
        context: {
          type: "string",
          description: "Optional extra context: error logs, file paths, links, constraints.",
        },
      },
      required: ["task"],
    },
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

function sbClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
}

// Resolve who is asking (tenant + agent), from the caller's bearer.
async function resolveContext(bearer: string | undefined): Promise<{ tenantId: string | null; agentId: string | null }> {
  const fallback = {
    tenantId: Deno.env.get("MANUS_DEFAULT_TENANT_ID") || null,
    agentId: null as string | null,
  };
  if (!bearer || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return fallback;
  try {
    const sb = sbClient()!;
    const { data } = await sb
      .from("agent_mcp_connections")
      .select("tenant_id, agent_id")
      .eq("state", "ready")
      .filter("oauth_tokens->>bearer", "eq", bearer);
    const rows = (data || []) as Array<{ tenant_id: string | null; agent_id: string | null }>;
    const tenants = Array.from(new Set(rows.map((r) => r.tenant_id).filter(Boolean)));
    if (tenants.length === 1) {
      const agents = Array.from(new Set(rows.map((r) => r.agent_id).filter(Boolean)));
      return {
        tenantId: tenants[0] as string,
        agentId: agents.length === 1 ? (agents[0] as string) : null,
      };
    }
    return fallback;
  } catch (e) {
    console.error("[manus-mcp] resolveContext failed:", (e as any)?.message ?? e);
    return fallback;
  }
}

// Get Manus API key from tenant_integrations (or global fallback secret)
async function getManusApiKey(tenantId: string | null): Promise<string> {
  const globalKey = Deno.env.get("MANUS_API_KEY") || "";
  if (!tenantId || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    if (!globalKey) throw new Error("Manus API key לא מוגדר — הגדר אותו בהגדרות אינטגרציות");
    return globalKey;
  }
  try {
    const sb = sbClient()!;
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

// Fire a Manus task and return task_url + share_url
async function fireManusTask(
  apiKey: string,
  prompt: string,
  agentProfile = "manus-1.6"
): Promise<{ taskId: string; taskUrl: string; shareUrl: string }> {
  const res = await fetch(`${MANUS_API_URL}/tasks`, {
    method: "POST",
    headers: {
      "API_KEY": apiKey,
      "Content-Type": "application/json",
      "accept": "application/json",
    },
    body: JSON.stringify({ prompt, agentProfile }),
  });
  const raw = await res.text();
  if (!res.ok) {
    let detail = raw.slice(0, 500);
    try { detail = JSON.parse(raw)?.error || detail; } catch { /* keep raw */ }
    throw new Error(`Manus API error [${res.status}]: ${detail}`);
  }
  let data: any = {};
  try { data = JSON.parse(raw); } catch { /* ignore */ }
  return {
    taskId: data?.task_id || data?.id || "—",
    taskUrl: data?.task_url || data?.url || `https://manus.ai/tasks/${data?.task_id || ""}`,
    shareUrl: data?.share_url || data?.task_url || data?.url || "",
  };
}

// Log the dispatch to manus_tasks table for history + context
async function logDispatch(args: {
  tenantId: string;
  agentId: string | null;
  taskId: string;
  prompt: string;
  taskUrl: string;
  shareUrl: string;
}): Promise<void> {
  const sb = sbClient();
  if (!sb) return;
  try {
    await sb.from("manus_tasks").insert({
      tenant_id: args.tenantId,
      task_id: args.taskId,
      title: args.prompt.substring(0, 100),
      prompt: args.prompt,
      status: "pending",
      task_url: args.taskUrl,
      share_url: args.shareUrl,
    });
  } catch (e) {
    console.error("[manus-mcp] logDispatch failed:", (e as any)?.message ?? e);
  }
}

// Get recent dispatches for context (avoid duplicating work)
async function recentDispatchContext(tenantId: string | null): Promise<string> {
  if (!tenantId) return "";
  const sb = sbClient();
  if (!sb) return "";
  try {
    const { data } = await sb
      .from("manus_tasks")
      .select("created_at, title, status, task_url")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(5);
    const rows = (data || []) as Array<any>;
    if (!rows.length) return "";
    const lines = rows.map((r) => {
      const when = String(r.created_at || "").slice(0, 16).replace("T", " ");
      const what = String(r.title || "").slice(0, 150);
      const url = r.task_url ? ` — ${r.task_url}` : "";
      return `• [${when} · ${r.status || "pending"}] ${what}${url}`;
    });
    return (
      `\n\n--- RECENT MANUS TASKS (most recent first) ---\n` +
      `Check if this request continues or duplicates earlier work before starting.\n` +
      lines.join("\n")
    );
  } catch (e) {
    console.error("[manus-mcp] recentDispatchContext failed:", (e as any)?.message ?? e);
    return "";
  }
}

// ─── Tool handlers ────────────────────────────────────────────────────────────

async function handleToolCall(
  name: string,
  args: Record<string, any>,
  ctx: { tenantId: string | null; agentId: string | null }
): Promise<string> {
  if (!ctx.tenantId) {
    throw new Error(
      "Could not resolve tenant. Make sure the MCP connection bearer is configured correctly in agent settings."
    );
  }

  const apiKey = await getManusApiKey(ctx.tenantId);
  const recentCtx = await recentDispatchContext(ctx.tenantId);

  // Notify instruction — Manus will call manus-notify when done
  const notifyInstruction =
    `\n\nWhen you finish, please notify David on WhatsApp by calling:\n` +
    `POST ${SUPABASE_URL}/functions/v1/manus-notify\n` +
    `Headers: { "Authorization": "Bearer <MANUS_MCP_BEARER>", "Content-Type": "application/json" }\n` +
    `Body: { "tenant_id": "${ctx.tenantId}", "message": "<your concise result summary with task link>" }`;

  if (name === "ask_manus") {
    const request = String(args?.request ?? "").trim();
    if (!request) throw new Error("ask_manus requires a non-empty 'request'.");
    const context = String(args?.context ?? "").trim();
    const agentProfile = String(args?.agent_profile ?? "manus-1.6").trim();

    const prompt =
      `[Carmen → Manus · REQUEST]\n` +
      `Requested by Carmen (AIOS agent), on behalf of David.\n\n` +
      `${request}\n` +
      (context ? `\nContext:\n${context}\n` : ``) +
      recentCtx +
      notifyInstruction;

    const { taskId, taskUrl, shareUrl } = await fireManusTask(apiKey, prompt, agentProfile);
    await logDispatch({ tenantId: ctx.tenantId, agentId: ctx.agentId, taskId, prompt: request, taskUrl, shareUrl });

    return (
      `✅ Dispatched your request to Manus. Manus is now working on it and will notify David on WhatsApp when finished.\n` +
      `Task: ${taskUrl}\n` +
      (shareUrl && shareUrl !== taskUrl ? `Share: ${shareUrl}` : ``)
    ).trim();
  }

  if (name === "request_dev_task") {
    const task = String(args?.task ?? "").trim();
    if (!task) throw new Error("request_dev_task requires a non-empty 'task'.");
    const branch = String(args?.branch ?? "main").trim();
    const context = String(args?.context ?? "").trim();

    const prompt =
      `[Carmen → Manus · DEV TASK]\n` +
      `Requested by Carmen (AIOS agent), on behalf of David.\n\n` +
      `Repository: davidcastelnuovo/aios\n` +
      `Base branch: ${branch}\n\n` +
      `Task:\n${task}\n` +
      (context ? `\nContext:\n${context}\n` : ``) +
      recentCtx +
      `\n\nPlease implement this in the AIOS codebase and open a pull request when done.` +
      notifyInstruction;

    const { taskId, taskUrl, shareUrl } = await fireManusTask(apiKey, prompt, "manus-1.6");
    await logDispatch({ tenantId: ctx.tenantId, agentId: ctx.agentId, taskId, prompt: task, taskUrl, shareUrl });

    return (
      `✅ Dispatched the dev task to Manus. Manus is now working on it and will open a pull request when finished.\n` +
      `Task: ${taskUrl}\n` +
      (shareUrl && shareUrl !== taskUrl ? `Share: ${shareUrl}` : ``)
    ).trim();
  }

  throw new Error(`Unknown tool: ${name}`);
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (req.method === "GET") {
    return new Response(
      JSON.stringify({ ok: true, server: SERVER_INFO, tools: TOOLS.map((t) => t.name) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  let msg: any;
  try {
    msg = await req.json();
  } catch {
    return rpcError(null, -32700, "Parse error");
  }

  const { id, method, params } = msg ?? {};

  // Bearer gate — MANUS_MCP_BEARER must match
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
