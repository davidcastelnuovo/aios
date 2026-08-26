// cursor-mcp — MCP server that lets Carmen (and any AIOS agent) escalate to
// Cursor Cloud Agents — the same runtime David uses here (repo + GitHub + DB).
//
// JSON-RPC 2.0 over HTTP (mcp-connect / _shared/mcp-tools dialect). Each
// tools/call prefers a sticky Cursor Cloud Agent per tenant (follow-up run via
// POST /v1/agents/{id}/runs) so conversation history is preserved; creates a
// new agent only when none exists / sticky is dead. Returns the agent URL.
//
// Tools:
//   - request_dev_task : code/feature/bugfix → Cursor implements + opens a PR
//   - ask_cursor       : research / analysis / planning / investigation
//   - generate_creative: send a job to the sticky AIOS Creative Direct image chat
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
//   CURSOR_STICKY_AGENT_ID  force one global sticky agent id (bc-…)
//   CURSOR_STICKY           "false" to disable sticky reuse (default true)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const SERVER_INFO = { name: "cursor-mcp", version: "1.1.0" };
const PROTOCOL_VERSION = "2024-11-05";
const MAX_TEXT = 100_000;
const DEFAULT_REPO = "https://github.com/davidcastelnuovo/aios";
const STICKY_ENABLED = (Deno.env.get("CURSOR_STICKY") || "true").toLowerCase() !== "false";

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
  {
    name: "generate_creative",
    description:
      "Send a job to AIOS Creative Direct — the dedicated image chat (like Carmen Direct). " +
      "Follow-ups go to the same sticky conversation, not a new coding agent. " +
      "It generates a finished Hebrew advertising still with GenerateImage and writes the PNG onto the marketing work item. " +
      "Use when David, Carmen, or מחלקת קריאייטיב needs images.",
    inputSchema: {
      type: "object",
      properties: {
        item_id: { type: "string", description: "marketing_work_items.id of the creative project." },
        director_note: { type: "string", description: "Optional fix request for a revision." },
        copy_label: { type: "string", description: "Optional copy-variation label to generate." },
      },
      required: ["item_id"],
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

type FireResult = { url: string; id: string; reused: boolean };

function cursorAuthHeaders(apiKey: string, basic = false): Record<string, string> {
  return {
    "Authorization": basic ? `Basic ${btoa(`${apiKey}:`)}` : `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "Accept": "application/json",
    "User-Agent": "aios-cursor-mcp/1.1",
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
  const forced = Deno.env.get("CURSOR_STICKY_AGENT_ID") || "";
  if (forced.startsWith("bc-")) return forced;
  if (!tenantId) return null;
  const sb = sbClient();
  if (!sb) return null;
  try {
    const { data } = await sb
      .from("cursor_sticky_agents")
      .select("cursor_agent_id")
      .eq("tenant_id", tenantId)
      .maybeSingle();
    const id = String((data as any)?.cursor_agent_id || "");
    if (id.startsWith("bc-")) return id;
    // Fallback: last successful dispatch for this tenant.
    const { data: last } = await sb
      .from("cursor_dispatches")
      .select("cursor_agent_id")
      .eq("tenant_id", tenantId)
      .not("cursor_agent_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const lastId = String((last as any)?.cursor_agent_id || "");
    return lastId.startsWith("bc-") ? lastId : null;
  } catch (e) {
    console.error("[cursor-mcp] getStickyAgentId failed:", (e as any)?.message ?? e);
    return null;
  }
}

async function saveStickyAgent(tenantId: string | null, agentId: string, sessionUrl: string): Promise<void> {
  if (!tenantId || !agentId.startsWith("bc-")) return;
  const sb = sbClient();
  if (!sb) return;
  try {
    await sb.from("cursor_sticky_agents").upsert({
      tenant_id: tenantId,
      cursor_agent_id: agentId,
      session_url: sessionUrl,
      updated_at: new Date().toISOString(),
    }, { onConflict: "tenant_id" });
  } catch (e) {
    console.error("[cursor-mcp] saveStickyAgent failed:", (e as any)?.message ?? e);
  }
}

async function clearStickyAgent(tenantId: string | null): Promise<void> {
  if (!tenantId) return;
  const sb = sbClient();
  if (!sb) return;
  try {
    await sb.from("cursor_sticky_agents").delete().eq("tenant_id", tenantId);
  } catch { /* ignore */ }
}

/** Follow-up on an existing sticky agent (preserves conversation + workspace). */
async function followUpStickyAgent(
  apiKey: string,
  agentId: string,
  promptText: string,
): Promise<FireResult | null> {
  const url = `https://api.cursor.com/v1/agents/${encodeURIComponent(agentId)}/runs`;
  // Retry a few times on agent_busy (only one run at a time).
  for (let attempt = 1; attempt <= 4; attempt++) {
    const resp = await cursorFetch(apiKey, url, {
      method: "POST",
      body: JSON.stringify({ prompt: { text: promptText } }),
    });
    const raw = await resp.text();
    if (resp.ok) {
      const parsed = parseAgentResponse(raw);
      // run responses nest agentId; keep sticky id
      return {
        id: agentId,
        url: parsed.url.includes("/agents/") ? parsed.url : `https://cursor.com/agents/${agentId}`,
        reused: true,
      };
    }
    if (resp.status === 409) {
      // Busy — wait and retry.
      await new Promise((r) => setTimeout(r, 2500 * attempt));
      continue;
    }
    // Dead / archived / not found → caller should create a new agent.
    if (resp.status === 404 || resp.status === 410 || resp.status === 400) {
      console.warn(`[cursor-mcp] sticky follow-up ${resp.status}: ${raw.slice(0, 200)}`);
      return null;
    }
    let detail = raw.slice(0, 500);
    try { detail = JSON.parse(raw)?.error?.message || JSON.parse(raw)?.message || detail; } catch { /* keep */ }
    throw new Error(`Cursor follow-up ${resp.status}: ${detail}`);
  }
  // Still busy — return the sticky URL so Carmen can point David at it.
  return {
    id: agentId,
    url: `https://cursor.com/agents/${agentId}`,
    reused: true,
  };
}

/** Create a brand-new Cursor Cloud Agent. */
async function createCursorAgent(apiKey: string, promptText: string, opts?: {
  name?: string;
  startingRef?: string;
}): Promise<FireResult> {
  const repoUrl = Deno.env.get("CURSOR_REPO_URL") || DEFAULT_REPO;
  const startingRef = opts?.startingRef || Deno.env.get("CURSOR_STARTING_REF") || "main";
  const envName = Deno.env.get("CURSOR_CLOUD_ENV_NAME") || "";
  const modelId = Deno.env.get("CURSOR_MODEL_ID") || "";
  const autoCreatePR = (Deno.env.get("CURSOR_AUTO_CREATE_PR") || "true").toLowerCase() !== "false";

  const body: Record<string, unknown> = {
    prompt: { text: promptText },
    autoCreatePR,
    name: (opts?.name || "Carmen → Cursor").slice(0, 100),
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
    let detail = raw.slice(0, 500);
    try { detail = JSON.parse(raw)?.error?.message || JSON.parse(raw)?.message || detail; } catch { /* keep */ }
    throw new Error(`Cursor agent create ${resp.status}: ${detail}`);
  }
  const parsed = parseAgentResponse(raw);
  return { ...parsed, reused: false };
}

/** Prefer sticky agent (history), else create new and remember it per tenant. */
async function fireCursorAgent(promptText: string, opts?: {
  name?: string;
  startingRef?: string;
  tenantId?: string | null;
}): Promise<FireResult> {
  const apiKey = Deno.env.get("CURSOR_API_KEY") || "";
  if (!apiKey) {
    throw new Error("Cursor is not configured (set CURSOR_API_KEY secret).");
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

  const created = await createCursorAgent(apiKey, text, opts);
  await saveStickyAgent(opts?.tenantId ?? null, created.id, created.url);
  return created;
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
    const { url, id, reused } = await fireCursorAgent(text, {
      name: `Carmen DEV: ${task.slice(0, 60)}`,
      startingRef: branch || undefined,
      tenantId: ctx.tenantId,
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
      `✅ Dispatched the dev task to Cursor Cloud Agent` +
      (reused ? ` (same sticky agent — history preserved)` : ` (new sticky agent for this tenant)`) +
      `. Cursor is now working on it and will open a pull request when finished.\n` +
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
    const { url, id, reused } = await fireCursorAgent(text, {
      name: `Carmen: ${request.slice(0, 60)}`,
      tenantId: ctx.tenantId,
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
    return (
      `✅ Sent your request to Cursor` +
      (reused ? ` (same sticky agent — history preserved)` : ` (new sticky agent for this tenant)`) +
      `. A Cloud Agent session is now running on it.\n` +
      `Session: ${url}`
    );
  }

  if (name === "generate_creative") {
    const itemId = String(args?.item_id ?? "").trim();
    if (!itemId) throw new Error("generate_creative requires item_id.");
    if (!ctx.tenantId) throw new Error("generate_creative needs a tenant on the MCP connection.");
    const directorNote = String(args?.director_note ?? "").trim();
    const copyLabel = String(args?.copy_label ?? "").trim();
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/cursor-generate-creative`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "dispatch",
        tenant_id: ctx.tenantId,
        item_id: itemId,
        prompt: [
          "You are already in AIOS Creative Direct — the dedicated image chat. This is one job.",
          "Generate ONE finished Hebrew advertising still with GenerateImage. Do not edit the repo. Do not open a PR.",
          `Load APPROVED CONCEPTS FIRST from marketing_work_items id=${itemId} (payload.approved_concepts, then copy_concepts). The photograph IS that concept (name, big idea, hook, visual language).`,
          "Copy (headline / CTA) is TYPE only — paint those exact RTL words on the concept photograph. Do not restage the headline as a new scene (no chat UI / Google search unless the concept itself is that).",
          "Then load brand kit and talent refs. Concept wins if copy disagrees.",
          copyLabel && `This card is copy variation «${copyLabel}» — same concept world, this line of type.`,
          directorNote && `REVISION REQUEST: ${directorNote}`,
          "Paint exact RTL Hebrew headline + CTA on the PNG unless the project has live_text_layers=true.",
        ].filter(Boolean).join("\n"),
        variation: {
          name: copyLabel || "וריאציה",
          copy_label: copyLabel || undefined,
        },
      }),
    });
    const raw = await resp.text();
    let data: any = {};
    try { data = JSON.parse(raw); } catch { /* ignore */ }
    if (!resp.ok || data?.error) {
      throw new Error(data?.error || `cursor-generate-creative ${resp.status}: ${raw.slice(0, 200)}`);
    }
    await logDispatch({
      tenantId: ctx.tenantId,
      agentId: ctx.agentId,
      tool: "ask_cursor",
      requestText: `${"[CREATIVE AGENT]"} Carmen asked for item ${itemId}`,
      context: directorNote,
      branch: "",
      sessionUrl: String(data.agent_url || ""),
      cursorAgentId: String(data.cursor_agent_id || ""),
    });
    return (
      `✅ נשלח לצ׳אט Creative Direct (אותו צ׳אט דביק — כמו כרמן ישיר)` +
      (data.agent_url ? `\nSession: ${data.agent_url}` : "") +
      `\nהתמונה תופיע על פרויקט הקריאייטיב אחרי שהצ׳אט מעלה אותה.`
    );
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
