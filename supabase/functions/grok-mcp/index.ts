// grok-mcp — MCP server that lets Carmen escalate to Grok Bot.
//
// Preferred path: POST to David's Grok Bot Cursor Automation webhook
// (GROK_BOT_WEBHOOK_URL + GROK_BOT_WEBHOOK_KEY). Grok Bot wakes, does the work,
// and replies to Carmen via carmen-mcp / ask_carmen.
//
// Fallback (when webhook secrets are unset): launch a Cursor Cloud Agent pinned
// to a Grok model (sticky per tenant via grok_sticky_agents).
//
// JSON-RPC 2.0 over HTTP (mcp-connect / _shared/mcp-tools dialect).
//
// Tools:
//   - request_dev_task : code/feature/bugfix → Grok implements + opens a PR
//   - ask_grok         : research / analysis / planning / investigation
//
// Required Supabase secrets:
//   GROK_MCP_BEARER     shared secret Carmen's MCP client must present
//                       (falls back to CURSOR_MCP_BEARER if unset)
// Webhook mode (recommended):
//   GROK_BOT_WEBHOOK_URL   https://api2.cursor.sh/automations/webhook/…
//   GROK_BOT_WEBHOOK_KEY   Bearer token from the automation panel
// Cloud-agent fallback:
//   CURSOR_API_KEY
// Optional:
//   GROK_MODEL_ID       default cursor-grok-4.6-high-fast
//   GROK_STICKY         "false" to disable sticky reuse (default true)
//   GROK_STICKY_AGENT_ID force one global sticky agent id (bc-…)
//   CURSOR_CLOUD_ENV_NAME / CURSOR_REPO_URL / CURSOR_STARTING_REF / CURSOR_AUTO_CREATE_PR
//   CURSOR_DEFAULT_TENANT_ID / CLAUDE_DEFAULT_TENANT_ID  fallback tenant
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import {
  compactToolsForGrok,
  grokCompatibleInitializeResult,
  handleStreamableMcpRequest,
  isStreamableMcpPath,
  wantsStreamableHttp,
  type McpRpcMessage,
} from "../_shared/mcp-streamable-http.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, accept, mcp-session-id, mcp-protocol-version",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Expose-Headers": "Mcp-Session-Id",
};

const SERVER_INFO = { name: "grok-mcp", version: "1.2.0" };
const GROK_MCP_STREAMABLE_URL =
  "https://zvoijyneresvkadpprel.supabase.co/functions/v1/grok-mcp/mcp";
const CURSOR_MCP_STREAMABLE_URL =
  "https://zvoijyneresvkadpprel.supabase.co/functions/v1/cursor-mcp/mcp";
const CARMEN_MCP_STREAMABLE_URL =
  "https://zvoijyneresvkadpprel.supabase.co/functions/v1/carmen-mcp/mcp";
const PROTOCOL_VERSION = "2024-11-05";
const MAX_TEXT = 100_000;
const DEFAULT_REPO = "https://github.com/davidcastelnuovo/aios";
const DEFAULT_GROK_MODEL = "cursor-grok-4.6-high-fast";
const STICKY_ENABLED = (Deno.env.get("GROK_STICKY") || "true").toLowerCase() !== "false";

const TOOLS = [
  {
    name: "request_dev_task",
    description:
      "Send a software-development task to Grok Bot (David's Grok-powered Cloud Agent). " +
      "Grok reads the AIOS repository, implements the change on a branch, and opens a pull request — " +
      "the same way David asks Grok Bot to fix a bug or build a feature. " +
      "Use for bug fixes, new features, refactors, edge-function changes, DB/ops fixes, or config work. " +
      "Asynchronous: returns a session URL to track progress; the PR appears once Grok finishes. " +
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
        reply_via: {
          type: "string",
          enum: ["carmen", "cursor"],
          description: "Who should receive Grok's reply when done. Use cursor when Cursor Cloud Agent called this tool; default carmen.",
        },
        session_id: {
          type: "string",
          description: "When reply_via=cursor: the live Cursor chat bc-… to reply into (Grok Bot Direct). Do not omit if you want the reply in THIS chat.",
        },
      },
      required: ["task"],
    },
  },
  {
    name: "ask_grok",
    description:
      "Ask Grok Bot (David's Grok-powered Cloud Agent) to perform ANY task — research, analysis, writing, " +
      "planning, investigation — with full repo / GitHub / database access. " +
      "Asynchronous: returns an agent URL; Grok reports its work in the session and may open a PR.",
    inputSchema: {
      type: "object",
      properties: {
        request: {
          type: "string",
          description: "What you want Grok Bot to do, in plain language.",
        },
        context: {
          type: "string",
          description: "Optional extra context or constraints.",
        },
        reply_via: {
          type: "string",
          enum: ["carmen", "cursor"],
          description: "Who should receive Grok's reply when done. Use cursor when Cursor Cloud Agent called this tool; default carmen.",
        },
        session_id: {
          type: "string",
          description: "When reply_via=cursor: the live Cursor chat bc-… to reply into (Grok Bot Direct). Do not omit if you want the reply in THIS chat.",
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

function requiredBearer(): string {
  return Deno.env.get("GROK_MCP_BEARER") || Deno.env.get("CURSOR_MCP_BEARER") || "";
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

type FireResult = { url: string; id: string; reused: boolean; viaWebhook?: boolean };

function webhookConfig(): { url: string; key: string } | null {
  const url = String(Deno.env.get("GROK_BOT_WEBHOOK_URL") || "").trim();
  const key = String(Deno.env.get("GROK_BOT_WEBHOOK_KEY") || "").trim();
  if (!url || !key) return null;
  return { url, key };
}

function replyViaChannel(raw: unknown): "carmen" | "cursor" {
  return String(raw || "").trim().toLowerCase() === "cursor" ? "cursor" : "carmen";
}

function replyInstructions(channel: "carmen" | "cursor", sessionId?: string): string {
  if (channel === "cursor") {
    const sid = String(sessionId || Deno.env.get("GROK_DIRECT_AGENT_ID") || "").trim();
    const sessionLine = sid.startsWith("bc-")
      ? `reply_to_bc_id: ${sid}. Call reply_to_cursor_session({ session_id: "${sid}", message: "<your reply>" }).`
      : `Call reply_to_cursor_session with the session_id (bc-…) from this webhook.`;
    return (
      `Grok Bot Direct (like Carmen Direct): reply IN THE SAME Cursor chat — do NOT call ask_cursor ` +
      `(that opens a new agent). Use cursor-mcp tool reply_to_cursor_session at ${CURSOR_MCP_STREAMABLE_URL} ` +
      `(Authorization Bearer GROK_CURSOR_MCP_BEARER). ${sessionLine} Do NOT use ask_carmen.`
    );
  }
  return (
    `Reply to Carmen when finished via carmen-mcp ask_carmen at ${CARMEN_MCP_STREAMABLE_URL} ` +
    `(Streamable HTTP /mcp, Authorization Bearer CARMEN_MCP_BEARER).`
  );
}

async function fireGrokWebhook(
  task: string,
  context: string,
  opts?: { tool?: string; tenantId?: string | null; replyVia?: "carmen" | "cursor"; sessionId?: string },
): Promise<FireResult> {
  const cfg = webhookConfig();
  if (!cfg) {
    throw new Error(
      "Grok Bot webhook is not configured (set GROK_BOT_WEBHOOK_URL and GROK_BOT_WEBHOOK_KEY).",
    );
  }
  const trimmedTask = task.trim();
  if (!trimmedTask) {
    throw new Error("Grok Bot webhook requires a non-empty task.");
  }

  const contextParts: string[] = [];
  if (opts?.tool) contextParts.push(`tool: ${opts.tool}`);
  if (opts?.tenantId) contextParts.push(`tenant_id: ${opts.tenantId}`);
  contextParts.push(replyInstructions(opts?.replyVia ?? "carmen", opts?.sessionId));
  if (context.trim()) contextParts.push(context.trim());
  const payload = {
    task: trimmedTask.length > MAX_TEXT ? trimmedTask.slice(0, MAX_TEXT) : trimmedTask,
    context: contextParts.join("\n\n"),
  };

  const resp = await fetch(cfg.url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${cfg.key}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
      "User-Agent": "aios-grok-mcp/1.1",
    },
    body: JSON.stringify(payload),
  });
  const raw = await resp.text();
  if (!resp.ok) {
    let detail = raw.slice(0, 500);
    try { detail = JSON.parse(raw)?.error?.message || JSON.parse(raw)?.message || detail; } catch { /* keep */ }
    throw new Error(`Grok Bot webhook ${resp.status}: ${detail}`);
  }

  let id = `webhook-${Date.now()}`;
  try {
    const data = JSON.parse(raw);
    id = String(data?.id || data?.runId || data?.dispatchId || id);
  } catch { /* empty body is fine */ }

  return {
    id,
    url: `(Grok Bot automation — reply via ${opts?.replyVia === "cursor" ? "reply_to_cursor_session" : "ask_carmen"} when done)`,
    reused: false,
    viaWebhook: true,
  };
}

function cursorAuthHeaders(apiKey: string, basic = false): Record<string, string> {
  return {
    "Authorization": basic ? `Basic ${btoa(`${apiKey}:`)}` : `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "Accept": "application/json",
    "User-Agent": "aios-grok-mcp/1.0",
  };
}

async function cursorFetch(apiKey: string, url: string, init: RequestInit): Promise<Response> {
  const headers = { ...cursorAuthHeaders(apiKey, false), ...(init.headers || {}) };
  let resp = await fetch(url, { ...init, headers });
  if (resp.status === 401 || resp.status === 403) {
    const basicHeaders = { ...cursorAuthHeaders(apiKey, true), ...(init.headers || {}) };
    resp = await fetch(url, { ...init, headers: basicHeaders });
  }
  return resp;
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

async function getStickyAgentId(tenantId: string | null): Promise<string | null> {
  const forced = Deno.env.get("GROK_STICKY_AGENT_ID") || "";
  if (forced.startsWith("bc-")) return forced;
  if (!tenantId) return null;
  const sb = sbClient();
  if (!sb) return null;
  try {
    const { data } = await sb
      .from("grok_sticky_agents")
      .select("cursor_agent_id")
      .eq("tenant_id", tenantId)
      .maybeSingle();
    const id = String((data as any)?.cursor_agent_id || "");
    if (id.startsWith("bc-")) return id;
    const { data: last } = await sb
      .from("grok_dispatches")
      .select("cursor_agent_id")
      .eq("tenant_id", tenantId)
      .not("cursor_agent_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const lastId = String((last as any)?.cursor_agent_id || "");
    return lastId.startsWith("bc-") ? lastId : null;
  } catch (e) {
    console.error("[grok-mcp] getStickyAgentId failed:", (e as any)?.message ?? e);
    return null;
  }
}

async function saveStickyAgent(tenantId: string | null, agentId: string, sessionUrl: string): Promise<void> {
  if (!tenantId || !agentId.startsWith("bc-")) return;
  const sb = sbClient();
  if (!sb) return;
  try {
    await sb.from("grok_sticky_agents").upsert({
      tenant_id: tenantId,
      cursor_agent_id: agentId,
      session_url: sessionUrl,
      updated_at: new Date().toISOString(),
    }, { onConflict: "tenant_id" });
  } catch (e) {
    console.error("[grok-mcp] saveStickyAgent failed:", (e as any)?.message ?? e);
  }
}

async function clearStickyAgent(tenantId: string | null): Promise<void> {
  if (!tenantId) return;
  const sb = sbClient();
  if (!sb) return;
  try {
    await sb.from("grok_sticky_agents").delete().eq("tenant_id", tenantId);
  } catch { /* ignore */ }
}

async function followUpStickyAgent(
  apiKey: string,
  agentId: string,
  promptText: string,
): Promise<FireResult | null> {
  const url = `https://api.cursor.com/v1/agents/${encodeURIComponent(agentId)}/runs`;
  for (let attempt = 1; attempt <= 4; attempt++) {
    const resp = await cursorFetch(apiKey, url, {
      method: "POST",
      body: JSON.stringify({ prompt: { text: promptText } }),
    });
    const raw = await resp.text();
    if (resp.ok) {
      const parsed = parseAgentResponse(raw);
      return {
        id: agentId,
        url: parsed.url.includes("/agents/") ? parsed.url : `https://cursor.com/agents/${agentId}`,
        reused: true,
      };
    }
    if (resp.status === 409) {
      await new Promise((r) => setTimeout(r, 2500 * attempt));
      continue;
    }
    if (resp.status === 404 || resp.status === 410 || resp.status === 400) {
      console.warn(`[grok-mcp] sticky follow-up ${resp.status}: ${raw.slice(0, 200)}`);
      return null;
    }
    let detail = raw.slice(0, 500);
    try { detail = JSON.parse(raw)?.error?.message || JSON.parse(raw)?.message || detail; } catch { /* keep */ }
    throw new Error(`Grok follow-up ${resp.status}: ${detail}`);
  }
  return {
    id: agentId,
    url: `https://cursor.com/agents/${agentId}`,
    reused: true,
  };
}

async function createGrokAgent(apiKey: string, promptText: string, opts?: {
  name?: string;
  startingRef?: string;
  omitModel?: boolean;
}): Promise<FireResult> {
  const repoUrl = Deno.env.get("CURSOR_REPO_URL") || DEFAULT_REPO;
  const startingRef = opts?.startingRef || Deno.env.get("CURSOR_STARTING_REF") || "main";
  const envName = Deno.env.get("CURSOR_CLOUD_ENV_NAME") || "";
  const modelId = opts?.omitModel ? "" : (Deno.env.get("GROK_MODEL_ID") || DEFAULT_GROK_MODEL);
  const autoCreatePR = (Deno.env.get("CURSOR_AUTO_CREATE_PR") || "true").toLowerCase() !== "false";

  const body: Record<string, unknown> = {
    prompt: { text: promptText },
    autoCreatePR,
    name: (opts?.name || "Carmen → Grok Bot").slice(0, 100),
  };
  if (modelId) body.model = { id: modelId };
  if (envName) {
    body.env = { type: "cloud", name: envName };
  } else {
    body.repos = [{ url: repoUrl, startingRef }];
  }

  const resp = await cursorFetch(apiKey, "https://api.cursor.com/v1/agents", {
    method: "POST",
    body: JSON.stringify(body),
  });
  const raw = await resp.text();
  if (!resp.ok) {
    const looksLikeModel = /model/i.test(raw) && !opts?.omitModel && !!modelId;
    if (looksLikeModel) {
      console.warn(`[grok-mcp] model ${modelId} rejected, retrying without model id`);
      return createGrokAgent(apiKey, promptText, { ...opts, omitModel: true });
    }
    let detail = raw.slice(0, 500);
    try { detail = JSON.parse(raw)?.error?.message || JSON.parse(raw)?.message || detail; } catch { /* keep */ }
    throw new Error(`Grok agent create ${resp.status}: ${detail}`);
  }
  const parsed = parseAgentResponse(raw);
  return { ...parsed, reused: false };
}

async function fireGrokAgent(promptText: string, opts?: {
  name?: string;
  startingRef?: string;
  tenantId?: string | null;
  task?: string;
  context?: string;
  tool?: string;
  replyVia?: "carmen" | "cursor";
  sessionId?: string;
}): Promise<FireResult> {
  if (webhookConfig()) {
    const task = String(opts?.task || promptText).trim();
    const contextParts: string[] = [];
    if (opts?.startingRef) contextParts.push(`branch: ${opts.startingRef}`);
    if (opts?.context) contextParts.push(opts.context);
    if (opts?.name) contextParts.push(`label: ${opts.name}`);
    contextParts.push(replyInstructions(opts?.replyVia ?? "carmen", opts?.sessionId));
    contextParts.push(teachingBlock(opts?.tenantId ?? null).trim());
    return fireGrokWebhook(task, contextParts.join("\n\n"), {
      tool: opts?.tool,
      tenantId: opts?.tenantId ?? null,
      replyVia: opts?.replyVia ?? "carmen",
      sessionId: opts?.sessionId,
    });
  }

  const apiKey = Deno.env.get("CURSOR_API_KEY") || Deno.env.get("GROK_BOT_API_KEY") || "";
  if (!apiKey) {
    throw new Error(
      "Grok Bot is not configured (set GROK_BOT_WEBHOOK_URL + GROK_BOT_WEBHOOK_KEY, or CURSOR_API_KEY).",
    );
  }
  const text = promptText.length > MAX_TEXT ? promptText.slice(0, MAX_TEXT) : promptText;

  if (STICKY_ENABLED) {
    const stickyId = await getStickyAgentId(opts?.tenantId ?? null);
    if (stickyId) {
      const followed = await followUpStickyAgent(apiKey, stickyId, text);
      if (followed) {
        await saveStickyAgent(opts?.tenantId ?? null, followed.id, followed.url);
        return followed;
      }
      await clearStickyAgent(opts?.tenantId ?? null);
    }
  }

  const created = await createGrokAgent(apiKey, text, opts);
  await saveStickyAgent(opts?.tenantId ?? null, created.id, created.url);
  return created;
}

async function recentDispatchContext(tenantId: string | null): Promise<string> {
  if (!tenantId) return "";
  const sb = sbClient();
  if (!sb) return "";
  try {
    const { data } = await sb
      .from("grok_dispatches")
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
      `\n\n--- RECENT CONTEXT — what Carmen already asked Grok Bot (most recent first) ---\n` +
      `Before starting, read docs/carmen-learned-skills.md and the list below. If this request ` +
      `duplicates or continues earlier work, build on it (check the prior agent / its PR) instead ` +
      `of starting over.\n` +
      lines.join("\n")
    );
  } catch (e) {
    console.error("[grok-mcp] recentDispatchContext failed:", (e as any)?.message ?? e);
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
    await sb.from("grok_dispatches").insert({
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
    console.error("[grok-mcp] logDispatch failed:", (e as any)?.message ?? e);
  }
}

function teachingBlock(tenantId: string | null): string {
  const tenantLine = tenantId
    ? `Target tenant_id for the skin: ${tenantId}`
    : `Target tenant: UNKNOWN — skip the ai_skills write and only record to the repo doc.`;
  const callbackLine = tenantId
    ? `To update David directly on WhatsApp, run via Supabase (execute_sql / Management API): ` +
      `select public.claude_notify_david('<your concise update for David>', '${tenantId}'::uuid); ` +
      `— same guaranteed WhatsApp path as Cursor/Claude. Also keep a clear summary + PR link in your PR description.`
    : `Make sure David ends up informed — put a clear summary + PR link in your PR description.`;
  return (
    `\n\n--- TEACH CARMEN, KEEP DAVID UPDATED & FIX-ON-FAIL ---\n` +
    `This came from Carmen, an autonomous agent, because she could not do it herself.\n` +
    `You are Grok Bot (Cursor Cloud Agent running Grok), not Claude — identify as Grok / Grok Bot if asked.\n` +
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
    const replyVia = replyViaChannel(args?.reply_via);
    const sessionId = String(args?.session_id ?? "").trim();
    const recent = await recentDispatchContext(ctx.tenantId);
    const text =
      `[${replyVia === "cursor" ? "Cursor" : "Carmen"} → Grok Bot · DEV TASK]\n` +
      `Requested by ${replyVia === "cursor" ? "Cursor Cloud Agent" : "Carmen (AIOS agent)"}, on behalf of David.\n\n` +
      `Task:\n${task}\n` +
      (branch ? `\nBase/target branch: ${branch}\n` : ``) +
      (context ? `\nContext:\n${context}\n` : ``) +
      `\nPlease implement this in the AIOS codebase and open a pull request when done.` +
      recent +
      teachingBlock(ctx.tenantId);
    const webhookContext = [
      context,
      branch ? `branch: ${branch}` : "",
      recent,
    ].filter(Boolean).join("\n\n");
    const { url, id, reused, viaWebhook } = await fireGrokAgent(text, {
      name: `Carmen → Grok DEV: ${task.slice(0, 50)}`,
      startingRef: branch || undefined,
      tenantId: ctx.tenantId,
      task,
      context: webhookContext,
      tool: "request_dev_task",
      replyVia,
      sessionId,
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
    return viaWebhook
      ? (
        `✅ שלחתי את המשימה ל-Grok Bot (אוטומציית webhook). הוא יתעורר, יבצע, ` +
        `ויחזיר תשובה דרך ${replyVia === "cursor" ? "reply_to_cursor_session" : "ask_carmen"} כשיגמר.\n` +
        `Dispatch: ${id}`
      )
      : (
        `✅ Dispatched the dev task to Grok Bot` +
        (reused ? ` (same sticky agent — history preserved)` : ` (new sticky Grok agent for this tenant)`) +
        `. Grok is now working on it and will open a pull request when finished.\n` +
        `Session: ${url}`
      );
  }

  if (name === "ask_grok") {
    const request = String(args?.request ?? "").trim();
    if (!request) throw new Error("ask_grok requires a non-empty 'request'.");
    const context = String(args?.context ?? "").trim();
    const replyVia = replyViaChannel(args?.reply_via);
    const sessionId = String(args?.session_id ?? "").trim();
    const recent = await recentDispatchContext(ctx.tenantId);
    const text =
      `[${replyVia === "cursor" ? "Cursor" : "Carmen"} → Grok Bot · REQUEST]\n` +
      `Requested by ${replyVia === "cursor" ? "Cursor Cloud Agent" : "Carmen (AIOS agent)"}, on behalf of David.\n\n` +
      `${request}\n` +
      (context ? `\nContext:\n${context}\n` : ``) +
      recent +
      teachingBlock(ctx.tenantId);
    const webhookContext = [context, recent].filter(Boolean).join("\n\n");
    const { url, id, reused, viaWebhook } = await fireGrokAgent(text, {
      name: `Carmen → Grok: ${request.slice(0, 50)}`,
      tenantId: ctx.tenantId,
      task: request,
      context: webhookContext,
      tool: "ask_grok",
      replyVia,
      sessionId,
    });
    await logDispatch({
      tenantId: ctx.tenantId,
      agentId: ctx.agentId,
      tool: "ask_grok",
      requestText: request,
      context,
      branch: "",
      sessionUrl: url,
      cursorAgentId: id,
    });
    return viaWebhook
      ? (
        `✅ שלחתי את הבקשה ל-Grok Bot (אוטומציית webhook). הוא יתעורר, יעבוד על זה, ` +
        `ויחזיר תשובה דרך ${replyVia === "cursor" ? "reply_to_cursor_session" : "ask_carmen"} כשיגמר.\n` +
        `Dispatch: ${id}`
      )
      : (
        `✅ Sent your request to Grok Bot` +
        (reused ? ` (same sticky agent — history preserved)` : ` (new sticky Grok agent for this tenant)`) +
        `. A Grok session is now running on it.\n` +
        `Session: ${url}`
      );
  }

  throw new Error(`Unknown tool: ${name}`);
}

type RpcCtx = { tenantId: string | null; agentId: string | null; grokMode: boolean };

async function handleRpcMessage(msg: McpRpcMessage, ctx: RpcCtx, bearer?: string): Promise<Response> {
  const { id, method, params } = msg ?? {};
  const clientProtocol =
    typeof (params as any)?.protocolVersion === "string" ? (params as any).protocolVersion : undefined;

  try {
    switch (method) {
      case "initialize":
        return rpcResult(
          id,
          ctx.grokMode
            ? grokCompatibleInitializeResult(clientProtocol, SERVER_INFO)
            : {
              protocolVersion: PROTOCOL_VERSION,
              capabilities: { tools: {} },
              serverInfo: SERVER_INFO,
            },
        );
      case "notifications/initialized":
      case "initialized":
        return new Response("", { status: 202, headers: corsHeaders });
      case "ping":
        return rpcResult(id, {});
      case "tools/list":
        return rpcResult(id, {
          tools: ctx.grokMode ? compactToolsForGrok(TOOLS) : TOOLS,
        });
      case "tools/call": {
        const name = params?.name as string;
        const args = (params?.arguments ?? {}) as Record<string, any>;
        if (ctx.grokMode && !args.reply_via) args.reply_via = "cursor";
        try {
          const callCtx = await resolveContext(bearer);
          const text = await handleToolCall(name, args, callCtx);
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
    console.error("[grok-mcp]", e?.message ?? e);
    return rpcError(id, -32603, `Internal error: ${String(e?.message ?? e)}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const pathname = new URL(req.url).pathname;
  const streamable = wantsStreamableHttp(req, pathname) || isStreamableMcpPath(pathname);

  if (!streamable && req.method === "GET") {
    return new Response(
      JSON.stringify({
        ok: true,
        server: SERVER_INFO,
        tools: TOOLS.map((t) => t.name),
        streamable_http: GROK_MCP_STREAMABLE_URL,
        setup: "Cursor .mcp.json or Grok Bot Plugins → URL must end with /mcp + GROK_MCP_BEARER",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const gate = requiredBearer();
  const bearer = bearerFrom(req);
  if (gate && bearer !== gate) {
    if (streamable) {
      return handleStreamableMcpRequest(req, async (msg) =>
        rpcError(msg.id, -32001, "Unauthorized: invalid or missing bearer token", 401));
    }
    return rpcError(null, -32001, "Unauthorized: invalid or missing bearer token", 401);
  }

  const ctx: RpcCtx = { tenantId: null, agentId: null, grokMode: streamable };

  if (streamable) {
    return handleStreamableMcpRequest(req, (msg) => handleRpcMessage(msg, ctx, bearer));
  }

  let msg: McpRpcMessage;
  try {
    msg = await req.json();
  } catch {
    return rpcError(null, -32700, "Parse error");
  }

  return handleRpcMessage(msg, ctx, bearer);
});
