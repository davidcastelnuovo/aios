// manus-mcp — an MCP server that lets Carmen (and any AIOS agent) talk to
// Manus AI directly, the same way David asks Manus for things.
//
// It speaks JSON-RPC 2.0 over HTTP (same dialect as claude-mcp), so Carmen
// connects to it like any other MCP server. Each tools/call fires a real
// Manus task via the Manus API v2 and returns the task URL + share URL.
// Manus then works autonomously (with GitHub, Supabase, and all connectors)
// and can notify David via manus-notify when finished.
//
// Key behaviours:
//   - All tasks are created inside the AfterLead Manus project (MANUS_PROJECT_ID)
//     so Manus automatically receives the full project context + all credentials.
//   - Session continuity: if there is already an active (pending/running) Manus
//     task from the same tenant created within the last 24 h, new requests are
//     sent as follow-up messages to that task (task.sendMessage) rather than
//     opening a new task — keeping the full conversation context alive.
//
// Tools exposed:
//   - ask_manus        : any general request (research, analysis, writing, planning, code)
//   - request_dev_task : code/feature/bugfix work → Manus implements + opens a PR
//
// Required Supabase secrets:
//   MANUS_MCP_BEARER   shared secret Carmen's MCP client must present
// Optional:
//   MANUS_DEFAULT_TENANT_ID  fallback tenant when one can't be resolved from the bearer
//   MANUS_PROJECT_ID         Manus project ID to attach tasks to (default: oGUi7vCRzcPqA52KetUXnL)
//
// The Manus API key is read from tenant_integrations (integration_type='manus').

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const MANUS_API_BASE = "https://api.manus.ai";
// AfterLead project — tasks created here automatically inherit all project instructions + credentials.
const MANUS_PROJECT_ID = Deno.env.get("MANUS_PROJECT_ID") || "oGUi7vCRzcPqA52KetUXnL";
// How long (ms) an active task is considered "continuable" for session reuse.
const SESSION_REUSE_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const SERVER_INFO = { name: "manus-mcp", version: "2.1.0" };
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

// Create a new Manus task (API v2) inside the AfterLead project.
async function createManusTask(
  apiKey: string,
  prompt: string,
  agentProfile = "manus-1.6",
  title?: string
): Promise<{ taskId: string; taskUrl: string; shareUrl: string }> {
  const body: Record<string, any> = {
    message: { text: prompt },
    project_id: MANUS_PROJECT_ID,
    agent_profile: agentProfile,
    share_visibility: "team",
  };
  if (title) body.title = title.slice(0, 200);
  const res = await fetch(`${MANUS_API_BASE}/v2/task.create`, {
    method: "POST",
    headers: {
      "x-manus-api-key": apiKey,
      "Content-Type": "application/json",
      "accept": "application/json",
    },
    body: JSON.stringify(body),
  });
  const raw = await res.text();
  if (!res.ok) {
    let detail = raw.slice(0, 500);
    try { detail = JSON.parse(raw)?.error?.message || JSON.parse(raw)?.error || detail; } catch { /* keep raw */ }
    throw new Error(`Manus API error [${res.status}]: ${detail}`);
  }
  let data: any = {};
  try { data = JSON.parse(raw); } catch { /* ignore */ }
  const taskId = data?.data?.task_id || data?.task_id || data?.id || "—";
  const taskUrl = data?.data?.task_url || data?.task_url || `https://manus.im/t/${taskId}`;
  const shareUrl = data?.data?.share_url || data?.share_url || taskUrl;
  return { taskId, taskUrl, shareUrl };
}

// Send a follow-up message to an existing Manus task (session continuity).
async function sendManusMessage(
  apiKey: string,
  taskId: string,
  prompt: string,
  agentProfile = "manus-1.6"
): Promise<{ taskId: string; taskUrl: string; shareUrl: string }> {
  const res = await fetch(`${MANUS_API_BASE}/v2/task.sendMessage`, {
    method: "POST",
    headers: {
      "x-manus-api-key": apiKey,
      "Content-Type": "application/json",
      "accept": "application/json",
    },
    body: JSON.stringify({ task_id: taskId, message: { text: prompt }, agent_profile: agentProfile }),
  });
  const raw = await res.text();
  if (!res.ok) {
    // If the task no longer exists or is stopped, fall back to creating a new one.
    console.warn(`[manus-mcp] sendMessage failed for task ${taskId} [${res.status}] — will create new task`);
    return { taskId: "", taskUrl: "", shareUrl: "" }; // signal caller to retry with create
  }
  let data: any = {};
  try { data = JSON.parse(raw); } catch { /* ignore */ }
  const taskUrl = data?.data?.task_url || `https://manus.im/t/${taskId}`;
  const shareUrl = data?.data?.share_url || taskUrl;
  return { taskId, taskUrl, shareUrl };
}

// Find an active (pending/running) task for this tenant created within SESSION_REUSE_WINDOW_MS.
async function findActiveTask(tenantId: string): Promise<{ taskId: string; taskUrl: string } | null> {
  const sb = sbClient();
  if (!sb) return null;
  try {
    const cutoff = new Date(Date.now() - SESSION_REUSE_WINDOW_MS).toISOString();
    const { data } = await sb
      .from("manus_tasks")
      .select("task_id, task_url")
      .eq("tenant_id", tenantId)
      .in("status", ["pending", "running"])
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(1);
    const row = (data || [])[0] as any;
    if (row?.task_id) return { taskId: row.task_id, taskUrl: row.task_url || `https://manus.im/t/${row.task_id}` };
  } catch (e) {
    console.error("[manus-mcp] findActiveTask failed:", (e as any)?.message ?? e);
  }
  return null;
}

// Log the dispatch to manus_tasks table for history + context.
// If it's a continued session (same task_id already exists), update the record instead.
async function logDispatch(args: {
  tenantId: string;
  agentId: string | null;
  taskId: string;
  prompt: string;
  taskUrl: string;
  shareUrl: string;
  continued?: boolean;
}): Promise<void> {
  const sb = sbClient();
  if (!sb) return;
  try {
    if (args.continued) {
      // Just update updated_at so we know the task is still active
      await sb.from("manus_tasks")
        .update({ updated_at: new Date().toISOString() })
        .eq("tenant_id", args.tenantId)
        .eq("task_id", args.taskId);
    } else {
      await sb.from("manus_tasks").insert({
        tenant_id: args.tenantId,
        task_id: args.taskId,
        title: args.prompt.substring(0, 100),
        prompt: args.prompt,
        status: "pending",
        task_url: args.taskUrl,
        share_url: args.shareUrl,
      });
    }
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

  // Notify instruction — Manus will call manus-notify when done.
  // The bearer token is stored in MANUS_MCP_BEARER edge-function secret.
  const BEARER = Deno.env.get("MANUS_MCP_BEARER") || "<MANUS_MCP_BEARER>";
  const notifyInstruction =
    `\n\nWhen you finish, please notify David on WhatsApp by calling:\n` +
    `POST ${SUPABASE_URL}/functions/v1/manus-notify\n` +
    `Headers: { "Authorization": "Bearer ${BEARER}", "Content-Type": "application/json" }\n` +
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

    // Session continuity: reuse active task if available
    const activeTask = await findActiveTask(ctx.tenantId);
    let taskId: string, taskUrl: string, shareUrl: string, continued = false;
    if (activeTask) {
      const result = await sendManusMessage(apiKey, activeTask.taskId, prompt, agentProfile);
      if (result.taskId) {
        // Successfully continued existing session
        ({ taskId, taskUrl, shareUrl } = result);
        continued = true;
      } else {
        // sendMessage failed — create a new task
        ({ taskId, taskUrl, shareUrl } = await createManusTask(apiKey, prompt, agentProfile, request.slice(0, 120)));
      }
    } else {
      ({ taskId, taskUrl, shareUrl } = await createManusTask(apiKey, prompt, agentProfile, request.slice(0, 120)));
    }
    await logDispatch({ tenantId: ctx.tenantId, agentId: ctx.agentId, taskId, prompt: request, taskUrl, shareUrl, continued });

    const sessionNote = continued ? " (continued existing session)" : " (new task in AfterLead project)";
    return (
      `✅ Dispatched your request to Manus${sessionNote}. Manus is now working on it and will notify David on WhatsApp when finished.\n` +
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

    // Dev tasks always open a fresh task (each PR needs its own context)
    const { taskId, taskUrl, shareUrl } = await createManusTask(apiKey, prompt, "manus-1.6", task.slice(0, 120));
    await logDispatch({ tenantId: ctx.tenantId, agentId: ctx.agentId, taskId, prompt: task, taskUrl, shareUrl });

    return (
      `✅ Dispatched the dev task to Manus (new task in AfterLead project). Manus is now working on it and will open a pull request when finished.\n` +
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
