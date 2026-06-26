// claude-mcp — an MCP server that lets Carmen (and any AIOS agent) talk to
// "Claude the developer/assistant" directly, the same way David asks Claude for
// things.
//
// It speaks JSON-RPC 2.0 over HTTP (the dialect mcp-connect / _shared/mcp-tools
// already use), so Carmen connects to it like any other MCP server. Each
// tools/call fires a REAL Claude Code on the web session via the Routines API
// (https://platform.claude.com/docs/en/api/claude-code/routines-fire) and
// returns the session URL. Claude then works on the repo autonomously and opens
// a pull request — exactly like a normal Claude Code session.
//
// Tools exposed:
//   - request_dev_task : code/feature/bugfix work → Claude implements + opens a PR
//   - ask_claude       : any general request (research, analysis, writing, planning)
//
// When Carmen asks for help, the request also instructs Claude to: TEACH her
// (write a reusable skin into public.ai_skills so she can do it herself next
// time + record it in docs/carmen-learned-skills.md), KEEP DAVID UPDATED with
// the result, and FIX-ON-FAIL (if a previously-taught skin failed, fix it and
// let her retry). The tenant + agent are resolved server-side from the caller's
// bearer (no UUID has to be passed by the model).
//
// Required Supabase secrets:
//   CLAUDE_ROUTINE_ID     trig_… id of the routine created at claude.ai/code/routines
//   CLAUDE_ROUTINE_TOKEN  sk-ant-oat01-… per-routine bearer token
//   CLAUDE_MCP_BEARER     shared secret Carmen's MCP client must present (protects this endpoint)
// Optional:
//   CLAUDE_DEV_ROUTINE_ID / CLAUDE_DEV_ROUTINE_TOKEN  separate routine for dev tasks
//   CLAUDE_ROUTINE_BETA   override the experimental beta header (defaults below)
//   CLAUDE_DEFAULT_TENANT_ID  fallback tenant when one can't be resolved from the bearer
// redeploy: revert to the original claude-mcp (no dispatch WhatsApp ping) so Carmen's own
// session-URL relay is the single message — the extra ping had caused duplicate messages.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const ANTHROPIC_BETA = Deno.env.get("CLAUDE_ROUTINE_BETA") || "experimental-cc-routine-2026-04-01";
const ANTHROPIC_VERSION = "2023-06-01";
const SERVER_INFO = { name: "claude-mcp", version: "1.6.0" };
const PROTOCOL_VERSION = "2024-11-05";
const MAX_TEXT = 65_536; // Routines /fire hard limit on the `text` field.

const TOOLS = [
  {
    name: "request_dev_task",
    description:
      "Send a software-development task to Claude (David's coding agent / Claude Code). " +
      "Claude reads the AIOS repository, implements the change on a branch, and opens a pull request — " +
      "exactly the way David asks Claude to fix a bug or build a feature. " +
      "Use for bug fixes, new features, refactors, edge-function changes, or config work in the codebase. " +
      "Asynchronous: returns a session URL to track progress; the PR appears once Claude finishes. " +
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
          description: "Optional target/base branch. If omitted Claude uses a default claude/ branch.",
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
    name: "ask_claude",
    description:
      "Ask Claude (David's general assistant) to perform ANY task — research, analysis, writing, " +
      "planning, investigation — the same way David asks Claude. Runs a real Claude Code cloud session " +
      "with repository and connector access. Asynchronous: returns a session URL; Claude reports its work " +
      "in the session and may open a PR with notes/results.",
    inputSchema: {
      type: "object",
      properties: {
        request: {
          type: "string",
          description: "What you want Claude to do, in plain language.",
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

// Fire a Claude Code routine session and return its public session URL.
async function fireRoutine(routineId: string, token: string, text: string): Promise<string> {
  const body = text.length > MAX_TEXT ? text.slice(0, MAX_TEXT) : text;
  const resp = await fetch(`https://api.anthropic.com/v1/claude_code/routines/${routineId}/fire`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "anthropic-version": ANTHROPIC_VERSION,
      "anthropic-beta": ANTHROPIC_BETA,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text: body }),
  });
  const raw = await resp.text();
  if (!resp.ok) {
    let detail = raw.slice(0, 500);
    try { detail = JSON.parse(raw)?.error?.message || detail; } catch { /* keep raw */ }
    throw new Error(`Claude routine fire ${resp.status}: ${detail}`);
  }
  let data: any = {};
  try { data = JSON.parse(raw); } catch { /* ignore */ }
  return data?.claude_code_session_url || data?.claude_code_session_id || "(session created)";
}

function resolveRoutine(kind: "dev" | "general"): { id: string; token: string } {
  const generalId = Deno.env.get("CLAUDE_ROUTINE_ID") || "";
  const generalToken = Deno.env.get("CLAUDE_ROUTINE_TOKEN") || "";
  if (kind === "dev") {
    return {
      id: Deno.env.get("CLAUDE_DEV_ROUTINE_ID") || generalId,
      token: Deno.env.get("CLAUDE_DEV_ROUTINE_TOKEN") || generalToken,
    };
  }
  return { id: generalId, token: generalToken };
}

// Resolve who is asking (tenant + agent), from the caller's bearer. All "Claude"
// connections share the same CLAUDE_MCP_BEARER, so this only disambiguates when
// a single ready connection matches; otherwise we fall back to the configured
// default tenant. The model never has to pass a UUID.
async function resolveContext(bearer: string | undefined): Promise<{ tenantId: string | null; agentId: string | null }> {
  const fallback = { tenantId: Deno.env.get("CLAUDE_DEFAULT_TENANT_ID") || null, agentId: null as string | null };
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

function sbClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
}

// MEMORY: pull the last few Carmen → Claude dispatches for this tenant so a fresh
// routine session knows what was already asked (and where it landed) instead of
// starting cold. Returns a prompt block, or '' when there's nothing / no tenant.
async function recentDispatchContext(tenantId: string | null): Promise<string> {
  if (!tenantId) return "";
  const sb = sbClient();
  if (!sb) return "";
  try {
    const { data } = await sb
      .from("claude_dispatches")
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
      `\n\n--- RECENT CONTEXT — what Carmen already asked Claude (most recent first) ---\n` +
      `Before starting, read docs/carmen-learned-skills.md and the list below. If this request ` +
      `duplicates or continues earlier work, build on it (check the prior session / its PR) instead ` +
      `of starting over.\n` +
      lines.join("\n")
    );
  } catch (e) {
    console.error("[claude-mcp] recentDispatchContext failed:", (e as any)?.message ?? e);
    return "";
  }
}

// VISIBILITY (durable): persist the dispatch so David has a record of what Carmen
// asked + the live session URL, and future sessions can recall it. Never throws.
async function logDispatch(args: {
  tenantId: string | null; agentId: string | null; tool: string;
  requestText: string; context: string; branch: string; sessionUrl: string;
}): Promise<void> {
  const sb = sbClient();
  if (!sb) return;
  try {
    await sb.from("claude_dispatches").insert({
      tenant_id: args.tenantId,
      agent_id: args.agentId,
      tool: args.tool,
      request_text: args.requestText,
      context: args.context || null,
      branch: args.branch || null,
      session_url: args.sessionUrl || null,
    });
  } catch (e) {
    console.error("[claude-mcp] logDispatch failed:", (e as any)?.message ?? e);
  }
}

// Appended to every help request so Claude (a) solves the task, (b) makes Carmen
// independent next time, (c) keeps David in the loop with the result, and (d)
// treats a failed previously-taught skin as a fix-and-retry job. Carmen's side
// mirrors this in her always-on instruction + the `claude_escalation` skin.
function teachingBlock(tenantId: string | null, agentId: string | null): string {
  const tenantLine = tenantId
    ? `Target tenant_id for the skin: ${tenantId}`
    : `Target tenant: UNKNOWN — skip the ai_skills write and only record to the repo doc.`;
  const callbackLine = tenantId
    ? `To update David directly on WhatsApp, run this one line via your Supabase connector (execute_sql): ` +
      `select public.claude_notify_david('<your concise update for David>', '${tenantId}'::uuid); ` +
      `— it pushes the message to David's WhatsApp, guaranteed, independent of Carmen's live session. ` +
      `Also keep a clear summary + PR link in your PR description.`
    : `Make sure David ends up informed — put a clear summary + PR link in your PR description.`;
  return (
    `\n\n--- TEACH CARMEN, KEEP DAVID UPDATED & FIX-ON-FAIL ---\n` +
    `This came from Carmen, an autonomous agent, because she could not do it herself.\n` +
    `${tenantLine}\n` +
    `A) TEACH (only if genuinely reusable, not a trivial one-off):\n` +
    `   1. Make Carmen independent: insert a concise skin row into public.ai_skills via the Supabase connector with ` +
    `scope='tenant', tenant_id=<above>, is_active=true, created_by_agent=true, a short name + description, ` +
    `clear operational \`steps\`, a snake_case \`slug\`, a \`system_prompt\` with the exact procedure (which tools, in what order), ` +
    `and \`triggers\` (Hebrew + English phrases). Keep it tight and actionable.\n` +
    `   2. Remember it for your future sessions: append a short dated entry to docs/carmen-learned-skills.md and include it in your PR.\n` +
    `B) UPDATE DAVID: when you finish, make sure David is updated with the result. ${callbackLine}\n` +
    `C) FIX-ON-FAIL: if this request says a capability you previously taught Carmen FAILED in practice, that is the priority — ` +
    `diagnose the failure, fix the ai_skills skin and/or the underlying code, verify it works, and report exactly what you changed so Carmen can retry.\n` +
    `D) SAFETY (hard rules — see CLAUDE.md "Safety rules for autonomous fixes"): never widen anyone's access beyond their existing role/scope; ` +
    `no destructive or policy-widening SQL live (use a migration + PR); only safe scoped fixes autonomously. Log every autonomous prod change to ` +
    `public.claude_carmen_audit and report it. If a request would breach these, refuse and tell David.`
  );
}

async function handleToolCall(name: string, args: Record<string, any>, ctx: { tenantId: string | null; agentId: string | null }): Promise<string> {
  if (name === "request_dev_task") {
    const task = String(args?.task ?? "").trim();
    if (!task) throw new Error("request_dev_task requires a non-empty 'task'.");
    const { id, token } = resolveRoutine("dev");
    if (!id || !token) throw new Error("Claude dev routine is not configured (set CLAUDE_ROUTINE_ID / CLAUDE_ROUTINE_TOKEN secrets).");
    const branch = String(args?.branch ?? "").trim();
    const context = String(args?.context ?? "").trim();
    const text =
      `[Carmen → Claude · DEV TASK]\n` +
      `Requested by Carmen (AIOS agent), on behalf of David.\n\n` +
      `Task:\n${task}\n` +
      (branch ? `\nBase/target branch: ${branch}\n` : ``) +
      (context ? `\nContext:\n${context}\n` : ``) +
      `\nPlease implement this in the AIOS codebase and open a pull request when done.` +
      (await recentDispatchContext(ctx.tenantId)) +
      teachingBlock(ctx.tenantId, ctx.agentId);
    const url = await fireRoutine(id, token, text);
    await logDispatch({ tenantId: ctx.tenantId, agentId: ctx.agentId, tool: "request_dev_task", requestText: task, context, branch, sessionUrl: url });
    return `✅ Dispatched the dev task to Claude Code. Claude is now working on it and will open a pull request when finished.\nSession: ${url}`;
  }

  if (name === "ask_claude") {
    const request = String(args?.request ?? "").trim();
    if (!request) throw new Error("ask_claude requires a non-empty 'request'.");
    const { id, token } = resolveRoutine("general");
    if (!id || !token) throw new Error("Claude routine is not configured (set CLAUDE_ROUTINE_ID / CLAUDE_ROUTINE_TOKEN secrets).");
    const context = String(args?.context ?? "").trim();
    const text =
      `[Carmen → Claude · REQUEST]\n` +
      `Requested by Carmen (AIOS agent), on behalf of David.\n\n` +
      `${request}\n` +
      (context ? `\nContext:\n${context}\n` : ``) +
      (await recentDispatchContext(ctx.tenantId)) +
      teachingBlock(ctx.tenantId, ctx.agentId);
    const url = await fireRoutine(id, token, text);
    await logDispatch({ tenantId: ctx.tenantId, agentId: ctx.agentId, tool: "ask_claude", requestText: request, context, branch: "", sessionUrl: url });
    return `✅ Sent your request to Claude. A Claude Code session is now running on it.\nSession: ${url}`;
  }

  throw new Error(`Unknown tool: ${name}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Lightweight health check / friendly GET.
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

  // Optional shared-secret gate. If CLAUDE_MCP_BEARER is set, every caller must
  // present it (Carmen's MCP client forwards the connection's bearer token).
  const requiredBearer = Deno.env.get("CLAUDE_MCP_BEARER");
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
        // Notification — no response body expected.
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
          // Surface tool failures as an MCP tool error so the agent sees them.
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
    console.error("[claude-mcp]", e?.message ?? e);
    return rpcError(id, -32603, `Internal error: ${String(e?.message ?? e)}`);
  }
});
