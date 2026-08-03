// cursor-mcp — MCP server that lets Carmen (and any AIOS agent) escalate to
// Cursor Cloud Agents — the same runtime David uses here (repo + GitHub + DB).
//
// JSON-RPC 2.0 over HTTP (mcp-connect / _shared/mcp-tools dialect). Each
// tools/call creates a Cursor Cloud Agent via https://api.cursor.com/v1/agents
// and returns the agent URL (https://cursor.com/agents/<bcId>).
//
// Tools:
//   - request_dev_task : code/feature/bugfix → Cursor implements + opens a PR
//   - ask_cursor       : research / analysis / planning / investigation
//
// Required Supabase secrets:
//   CURSOR_API_KEY          API key from https://cursor.com/dashboard/api
//   CURSOR_MCP_BEARER       shared secret Carmen's MCP client must present
// Optional:
//   CURSOR_REPO_URL         default https://github.com/davidcastelnuovo/aios
//   CURSOR_STARTING_REF     default main
//   CURSOR_CLOUD_ENV_NAME   named Cursor cloud environment (preferred over bare repos)
//   CURSOR_MODEL_ID         e.g. composer-2.5 — omit for account default
//   CURSOR_AUTO_CREATE_PR   "false" to disable auto PR (default true)
//   CURSOR_DEFAULT_TENANT_ID fallback tenant when bearer can't resolve one
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const SERVER_INFO = { name: "cursor-mcp", version: "1.0.0" };
const PROTOCOL_VERSION = "2024-11-05";
const MAX_TEXT = 100_000;
const DEFAULT_REPO = "https://github.com/davidcastelnuovo/aios";

const TOOLS = [
  {
    name: "request_dev_task",
    description:
      "Send a software-development task to Cursor (David's coding Cloud Agent). " +
      "Cursor reads the AIOS repository, implements the change on a branch, and opens a pull request — " +
      "the same way David asks Cursor to fix a bug or build a feature. " +
      "Use for bug fixes, new features, refactors, edge-function changes, DB/ops fixes, or config work. " +
      "Asynchronous: returns a Cursor agent URL to track progress; the PR appears once Cursor finishes. " +
      "Write the task clearly and self-contained, like a ticket for a senior engineer.",
    inputSchema: {
      type: "object",
      properties: {
        task: {
          type: "string",
          description: "Clear, self-contained description of the development work to perform.",
        },
        branch: {
          type: "string",
          description: "Optional base branch (startingRef). Default: main.",
        },
        context: {
          type: "string",
          description: "Optional extra context: error logs, file paths, links, constraints, acceptance criteria.",
        },
      },
      required: ["task"],
    },
  },
  {
    name: "ask_cursor",
    description:
      "Ask Cursor (David's Cloud Agent) to perform ANY task — research, analysis, writing, " +
      "planning, investigation — with full repo / GitHub / database access. " +
      "Asynchronous: returns an agent URL; Cursor reports its work in the session and may open a PR.",
    inputSchema: {
      type: "object",
      properties: {
        request: {
          type: "string",
          description: "What you want Cursor to do, in plain language.",
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

function sbClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
}

async function resolveContext(
  bearer: string | undefined,
): Promise<{ tenantId: string | null; agentId: string | null }> {
  const fallback = {
    tenantId: Deno.env.get("CURSOR_DEFAULT_TENANT_ID") ||
      Deno.env.get("CLAUDE_DEFAULT_TENANT_ID") ||
      null,
    agentId: null as string | null,
  };
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

/** Create a Cursor Cloud Agent and return its public URL + id. */
async function fireCursorAgent(promptText: string, opts?: {
  name?: string;
  startingRef?: string;
}): Promise<{ url: string; id: string }> {
  const apiKey = Deno.env.get("CURSOR_API_KEY") || "";
  if (!apiKey) {
    throw new Error("Cursor is not configured (set CURSOR_API_KEY secret).");
  }

  const text = promptText.length > MAX_TEXT ? promptText.slice(0, MAX_TEXT) : promptText;
  const repoUrl = Deno.env.get("CURSOR_REPO_URL") || DEFAULT_REPO;
  const startingRef = opts?.startingRef || Deno.env.get("CURSOR_STARTING_REF") || "main";
  const envName = Deno.env.get("CURSOR_CLOUD_ENV_NAME") || "";
  const modelId = Deno.env.get("CURSOR_MODEL_ID") || "";
  const autoCreatePR = (Deno.env.get("CURSOR_AUTO_CREATE_PR") || "true").toLowerCase() !== "false";

  const body: Record<string, unknown> = {
    prompt: { text },
    autoCreatePR,
    name: (opts?.name || "Carmen → Cursor").slice(0, 100),
  };

  if (modelId) body.model = { id: modelId };

  // Prefer a named cloud environment (same VM setup David uses) when configured.
  if (envName) {
    body.env = { type: "cloud", name: envName };
  } else {
    body.repos = [{ url: repoUrl, startingRef }];
  }

  const resp = await fetch("https://api.cursor.com/v1/agents", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
      "User-Agent": "aios-cursor-mcp/1.0",
    },
    body: JSON.stringify(body),
  });

  const raw = await resp.text();
  if (!resp.ok) {
    // Retry once with Basic auth (some API key types prefer -u KEY:)
    if (resp.status === 401 || resp.status === 403) {
      const basic = btoa(`${apiKey}:`);
      const retry = await fetch("https://api.cursor.com/v1/agents", {
        method: "POST",
        headers: {
          "Authorization": `Basic ${basic}`,
          "Content-Type": "application/json",
          "Accept": "application/json",
          "User-Agent": "aios-cursor-mcp/1.0",
        },
        body: JSON.stringify(body),
      });
      const retryRaw = await retry.text();
      if (!retry.ok) {
        let detail = retryRaw.slice(0, 500);
        try { detail = JSON.parse(retryRaw)?.error?.message || JSON.parse(retryRaw)?.message || detail; } catch { /* keep */ }
        throw new Error(`Cursor agent create ${retry.status}: ${detail}`);
      }
      return parseAgentResponse(retryRaw);
    }
    let detail = raw.slice(0, 500);
    try { detail = JSON.parse(raw)?.error?.message || JSON.parse(raw)?.message || detail; } catch { /* keep */ }
    throw new Error(`Cursor agent create ${resp.status}: ${detail}`);
  }
  return parseAgentResponse(raw);
}

function parseAgentResponse(raw: string): { url: string; id: string } {
  let data: any = {};
  try { data = JSON.parse(raw); } catch { /* ignore */ }
  const agent = data?.agent || data;
  const id = String(agent?.id || data?.id || "");
  const url = String(
    agent?.url ||
      data?.url ||
      (id ? `https://cursor.com/agents/${id}` : "") ||
      "(agent created)",
  );
  return { url, id: id || url };
}

async function recentDispatchContext(tenantId: string | null): Promise<string> {
  if (!tenantId) return "";
  const sb = sbClient();
  if (!sb) return "";
  try {
    const { data } = await sb
      .from("cursor_dispatches")
      .select("created_at, tool, request_text, session_url, status")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(5);
    const rows = (data || []) as Array<any>;
    if (!rows.length) return "";
    const lines = rows.map((r) => {
      const when = String(r.created_at || "").slice(0, 16).replace("T", " ");
      const what = String(r.request_text || "").replace(/\s+/g, " ").slice(0, 200);
      const tag = r.tool === "request_dev_task" ? "DEV" : "ASK";
      const sess = r.session_url ? ` — ${r.session_url}` : "";
      return `• [${when} · ${tag} · ${r.status || "dispatched"}] ${what}${sess}`;
    });
    return (
      `\n\n--- RECENT CONTEXT — what Carmen already asked Cursor (most recent first) ---\n` +
      `Before starting, read docs/carmen-learned-skills.md and the list below. If this request ` +
      `duplicates or continues earlier work, build on it (check the prior agent / its PR) instead ` +
      `of starting over.\n` +
      lines.join("\n")
    );
  } catch (e) {
    console.error("[cursor-mcp] recentDispatchContext failed:", (e as any)?.message ?? e);
    return "";
  }
}

async function logDispatch(args: {
  tenantId: string | null;
  agentId: string | null;
  tool: string;
  requestText: string;
  context: string;
  branch: string;
  sessionUrl: string;
  cursorAgentId: string;
}): Promise<void> {
  const sb = sbClient();
  if (!sb) return;
  try {
    await sb.from("cursor_dispatches").insert({
      tenant_id: args.tenantId,
      agent_id: args.agentId,
      tool: args.tool,
      request_text: args.requestText,
      context: args.context || null,
      branch: args.branch || null,
      session_url: args.sessionUrl || null,
      cursor_agent_id: args.cursorAgentId || null,
    });
  } catch (e) {
    console.error("[cursor-mcp] logDispatch failed:", (e as any)?.message ?? e);
  }
}

function teachingBlock(tenantId: string | null): string {
  const tenantLine = tenantId
    ? `Target tenant_id for the skin: ${tenantId}`
    : `Target tenant: UNKNOWN — skip the ai_skills write and only record to the repo doc.`;
  const callbackLine = tenantId
    ? `To update David directly on WhatsApp, run via Supabase (execute_sql / Management API): ` +
      `select public.claude_notify_david('<your concise update for David>', '${tenantId}'::uuid); ` +
      `— same guaranteed WhatsApp path as Claude. Also keep a clear summary + PR link in your PR description.`
    : `Make sure David ends up informed — put a clear summary + PR link in your PR description.`;
  return (
    `\n\n--- TEACH CARMEN, KEEP DAVID UPDATED & FIX-ON-FAIL ---\n` +
    `This came from Carmen, an autonomous agent, because she could not do it herself.\n` +
    `You are Cursor (Cloud Agent), not Claude — identify as Cursor if asked.\n` +
    `${tenantLine}\n` +
    `A) TEACH (only if genuinely reusable, not a trivial one-off):\n` +
    `   1. Make Carmen independent: insert a concise skin row into public.ai_skills via Supabase with ` +
    `scope='tenant', tenant_id=<above>, is_active=true, created_by_agent=true, a short name + description, ` +
    `clear operational steps, a snake_case slug, a system_prompt with the exact procedure, ` +
    `and triggers (Hebrew + English phrases).\n` +
    `   2. Remember it for future sessions: append a short dated entry to docs/carmen-learned-skills.md and include it in your PR.\n` +
    `B) UPDATE DAVID: when you finish, make sure David is updated with the result. ${callbackLine}\n` +
    `C) FIX-ON-FAIL: if this request says a capability previously taught to Carmen FAILED in practice, that is the priority — ` +
    `diagnose, fix the ai_skills skin and/or underlying code, verify, and report what changed so Carmen can retry.\n` +
    `D) SAFETY (hard rules — see CLAUDE.md / AGENTS.md "Safety rules for autonomous fixes"): never widen anyone's access beyond their existing role/scope; ` +
    `no destructive or policy-widening SQL live (use a migration + PR); only safe scoped fixes autonomously. Log every autonomous prod change to ` +
    `public.claude_carmen_audit and report it. If a request would breach these, refuse and tell David.`
  );
}

async function handleToolCall(
  name: string,
  args: Record<string, any>,
  ctx: { tenantId: string | null; agentId: string | null },
): Promise<string> {
  if (name === "request_dev_task") {
    const task = String(args?.task ?? "").trim();
    if (!task) throw new Error("request_dev_task requires a non-empty 'task'.");
    const branch = String(args?.branch ?? "").trim();
    const context = String(args?.context ?? "").trim();
    const text =
      `[Carmen → Cursor · DEV TASK]\n` +
      `Requested by Carmen (AIOS agent), on behalf of David.\n\n` +
      `Task:\n${task}\n` +
      (branch ? `\nBase/target branch: ${branch}\n` : ``) +
      (context ? `\nContext:\n${context}\n` : ``) +
      `\nPlease implement this in the AIOS codebase and open a pull request when done.` +
      (await recentDispatchContext(ctx.tenantId)) +
      teachingBlock(ctx.tenantId);
    const { url, id } = await fireCursorAgent(text, {
      name: `Carmen DEV: ${task.slice(0, 60)}`,
      startingRef: branch || undefined,
    });
    await logDispatch({
      tenantId: ctx.tenantId,
      agentId: ctx.agentId,
      tool: "request_dev_task",
      requestText: task,
      context,
      branch,
      sessionUrl: url,
      cursorAgentId: id,
    });
    return (
      `✅ Dispatched the dev task to Cursor Cloud Agent. Cursor is now working on it and will open a pull request when finished.\n` +
      `Session: ${url}`
    );
  }

  if (name === "ask_cursor") {
    const request = String(args?.request ?? "").trim();
    if (!request) throw new Error("ask_cursor requires a non-empty 'request'.");
    const context = String(args?.context ?? "").trim();
    const text =
      `[Carmen → Cursor · REQUEST]\n` +
      `Requested by Carmen (AIOS agent), on behalf of David.\n\n` +
      `${request}\n` +
      (context ? `\nContext:\n${context}\n` : ``) +
      (await recentDispatchContext(ctx.tenantId)) +
      teachingBlock(ctx.tenantId);
    const { url, id } = await fireCursorAgent(text, {
      name: `Carmen: ${request.slice(0, 60)}`,
    });
    await logDispatch({
      tenantId: ctx.tenantId,
      agentId: ctx.agentId,
      tool: "ask_cursor",
      requestText: request,
      context,
      branch: "",
      sessionUrl: url,
      cursorAgentId: id,
    });
    return `✅ Sent your request to Cursor. A Cloud Agent session is now running on it.\nSession: ${url}`;
  }

  throw new Error(`Unknown tool: ${name}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

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

  const requiredBearer = Deno.env.get("CURSOR_MCP_BEARER");
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
    console.error("[cursor-mcp]", e?.message ?? e);
    return rpcError(id, -32603, `Internal error: ${String(e?.message ?? e)}`);
  }
});
