// cursor-mcp — MCP server that lets Carmen (and Grok Bot) escalate to Cursor Cloud Agents.
//
// Grok Bot → Cursor: Settings → Plugins → custom MCP → …/cursor-mcp/mcp + CURSOR_MCP_BEARER
// Carmen (legacy): …/cursor-mcp + CURSOR_MCP_BEARER via mcp-connect
//
// Tools:
//   - request_dev_task : code/feature/bugfix → Cursor implements + opens a PR
//   - ask_cursor       : research / analysis / planning / investigation
//   - generate_creative: send a job to the sticky AIOS Creative Direct image chat
//
// Required Supabase secrets:
//   CURSOR_API_KEY          API key from https://cursor.com/dashboard/api
//   CURSOR_MCP_BEARER       Carmen's MCP client (mcp-connect / agent_mcp_connections)
//   GROK_CURSOR_MCP_BEARER  Grok Bot direct → Cursor only (separate from Carmen)
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
import {
  compactToolsForGrok,
  grokCompatibleInitializeResult,
  handleStreamableMcpRequest,
  isStreamableMcpPath,
  wantsStreamableHttp,
  type McpRpcMessage,
} from "../_shared/mcp-streamable-http.ts";
import { completeHumanCursorTask, extractHumanTaskId } from "../_shared/cursor-task-queue.ts";
import { cursorModelBody, resolveCodingCursorModel } from "../_shared/cursorCreativeModel.ts";
import {
  cursorSessionUrl,
  missingCursorDirectSessionError,
  resolveCursorDirectSession,
  type CursorDirectSession,
} from "../_shared/cursor-direct-session.ts";
import {
  cursorSessionDisplayName,
  fetchHumanTaskTitle,
  findCursorSessionForTask,
  formatCursorSessionsForAgent,
  listCursorTaskSessions,
  resolveAppEnv,
  trackCursorTaskSession,
  touchCursorTaskSession,
} from "../_shared/cursor-session-tracker.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, accept, mcp-session-id, mcp-protocol-version",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Expose-Headers": "Mcp-Session-Id",
};

const SERVER_INFO = { name: "cursor-mcp", version: "1.4.0" };
const CURSOR_MCP_STREAMABLE_URL =
  "https://zvoijyneresvkadpprel.supabase.co/functions/v1/cursor-mcp/mcp";
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
      "Ask Cursor (David's Cloud Agent) to perform a NEW research/analysis/planning task — " +
      "may create or follow a coding sticky agent and open a PR. " +
      "Do NOT use for connection tests, pings, or messages into the fixed Cursor Direct chat — " +
      "use get_cursor_direct_session + reply_to_cursor_session instead (no new Background Agent).",
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
      "Send a job to קריאייטיב דיירקט, the dedicated image chat (Carmen's איש קריאייטיב skin). " +
      "Follow-ups go to the same sticky conversation. Do not re-explain the art-director role. " +
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
  {
    name: "get_cursor_direct_session",
    description:
      "Read-only: return the fixed Cursor Direct chat (bc-…) configured for this tenant/environment. " +
      "Does NOT open a new Background Agent or consume usage-based credits. " +
      "Call before reply_to_cursor_session for connection tests " +
      '(e.g. "תעבירי לקרסר: בדיקת חיבור מפריוויו", "בדיקת ערוץ ישיר"). ' +
      "Never use ask_cursor or request_dev_task for those.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "reply_to_cursor_session",
    description:
      "Post a message into the fixed or specific live Cursor Direct chat (bc-…). " +
      "Does NOT open a new Background Agent. " +
      "For Carmen Direct / connection tests: omit session_id to use the configured fixed session " +
      "(or call get_cursor_direct_session first). " +
      "For Grok webhooks: pass reply_to_bc_id as session_id. " +
      "Never use ask_cursor or request_dev_task for pings or replies into the live direct chat.",
    inputSchema: {
      type: "object",
      properties: {
        session_id: {
          type: "string",
          description: "Optional bc-… id. Omit to use the configured fixed Cursor Direct session.",
        },
        message: {
          type: "string",
          description: "What to say in that Cursor chat.",
        },
        context: {
          type: "string",
          description: "Optional extra notes (files, links, what you did).",
        },
      },
      required: ["message"],
      additionalProperties: false,
    },
  },
  {
    name: "reply_to_aios_session",
    description:
      "Deliver a finished answer into the AIOS Carmen conversation that dispatched this agent. " +
      "Writes directly to the Command Center thread. Do not call ask_carmen to deliver the answer.",
    inputSchema: {
      type: "object",
      properties: {
        conversation_id: { type: "string" },
        session_id: { type: "string" },
        origin: { type: "string" },
        content: { type: "string" },
        idempotency_key: { type: "string" },
      },
      required: ["conversation_id", "content"],
    },
  },
  {
    name: "list_cursor_task_sessions",
    description:
      "Read-only: list Cursor Cloud Agent sessions tracked by AIOS (bc-… per task). " +
      "Use to find which session belongs to which task — no fixed session id needed. " +
      "Does NOT open a new Background Agent.",
    inputSchema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          description: "Optional filter: active | running | completed | busy | failed",
        },
        limit: { type: "number", description: "Max rows (default 20)." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_cursor_task_session",
    description:
      "Read-only: look up the Cursor session for a human task id (public.tasks). " +
      "Returns session_id, url, display name, and status. Does NOT open a new agent.",
    inputSchema: {
      type: "object",
      properties: {
        task_id: { type: "string", description: "public.tasks.id (UUID)." },
      },
      required: ["task_id"],
      additionalProperties: false,
    },
  },
  {
    name: "complete_human_task",
    description:
      "Mark a public.tasks row complete after finishing Cursor work from the human task queue. " +
      "Call when context includes human_task_id. Automatically dispatches the next queued Cursor task.",
    inputSchema: {
      type: "object",
      properties: {
        task_id: { type: "string", description: "UUID from human_task_id in the task context." },
        summary: { type: "string", description: "Short completion note for the task log." },
      },
      required: ["task_id"],
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

function acceptedBearers(): string[] {
  return [
    Deno.env.get("CURSOR_MCP_BEARER") || "",
    Deno.env.get("GROK_CURSOR_MCP_BEARER") || "",
  ].filter(Boolean);
}

function isAuthorizedBearer(bearer: string | undefined): boolean {
  const allowed = acceptedBearers();
  if (!allowed.length) return true;
  return !!bearer && allowed.includes(bearer);
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

type FireResult = {
  url: string;
  id: string;
  reused: boolean;
  delivered?: boolean;
  parallel?: boolean;
  stickyUrl?: string;
};

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
  const sessionUrl = `https://cursor.com/agents/${agentId}`;
  // Cursor allows one run per agent. A long retry loop makes Carmen's MCP client
  // time out, and a fake success after 409 drops the message. One short retry only.
  for (let attempt = 1; attempt <= 2; attempt++) {
    const resp = await cursorFetch(apiKey, url, {
      method: "POST",
      body: JSON.stringify({ prompt: { text: promptText } }),
    });
    const raw = await resp.text();
    if (resp.ok) {
      const parsed = parseAgentResponse(raw);
      return {
        id: agentId,
        url: parsed.url.includes("/agents/") ? parsed.url : sessionUrl,
        reused: true,
        delivered: true,
      };
    }
    if (resp.status === 409) {
      if (attempt === 1) await new Promise((r) => setTimeout(r, 1500));
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
  return {
    id: agentId,
    url: sessionUrl,
    reused: true,
    delivered: false,
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
    model: cursorModelBody(resolveCodingCursorModel(modelId)),
  };
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
  console.log(`[cursor-mcp] new_background_agent action=create_agent id=${parsed.id}`);
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
      if (followed?.delivered) {
        console.log(`[cursor-mcp] coding_sticky_followup session_id=${stickyId}`);
        await saveStickyAgent(opts?.tenantId ?? null, followed.id, followed.url);
        return followed;
      }
      if (followed && followed.delivered === false) {
        // Sticky is mid-run. Open a parallel agent so the message is not dropped,
        // but do NOT steal the sticky pointer away from the live coding session.
        const created = await createCursorAgent(apiKey, text, opts);
        return {
          ...created,
          parallel: true,
          stickyUrl: followed.url,
        };
      }
      await clearStickyAgent(opts?.tenantId ?? null);
    }
  }

  const created = await createCursorAgent(apiKey, text, opts);
  await saveStickyAgent(opts?.tenantId ?? null, created.id, created.url);
  return created;
}

function formatDispatchReply(kind: string, fired: FireResult): string {
  if (fired.parallel) {
    return (
      `✅ Sticky Cursor session is mid-run so this ${kind} was opened in a PARALLEL agent (message was delivered there, not dropped).\n` +
      `Parallel session: ${fired.url}\n` +
      (fired.stickyUrl ? `Original sticky (still busy): ${fired.stickyUrl}\n` : "") +
      `To talk inside the live sticky chat, use reply_to_cursor_session when that run is idle.`
    );
  }
  return (
    `✅ Sent your ${kind} to Cursor` +
    (fired.reused ? ` (same sticky agent — history preserved)` : ` (new sticky agent for this tenant)`) +
    `. A Cloud Agent session is now running on it.\n` +
    `Session: ${fired.url}`
  );
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
  humanTaskId?: string | null;
  taskTitle?: string | null;
  displayName?: string | null;
  reused?: boolean;
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
      human_task_id: args.humanTaskId || null,
    });

    if (!args.tenantId || !args.cursorAgentId?.startsWith("bc-")) return;

    if (args.reused) {
      await touchCursorTaskSession(sb, args.cursorAgentId, "running");
      console.log(`[cursor-mcp] session_touch session_id=${args.cursorAgentId} tool=${args.tool}`);
      return;
    }

    const displayName = args.displayName || cursorSessionDisplayName({
      taskTitle: args.taskTitle,
      requestText: args.requestText,
      sourceTool: args.tool,
    });
    await trackCursorTaskSession(sb, {
      tenantId: args.tenantId,
      cursorAgentId: args.cursorAgentId,
      sessionUrl: args.sessionUrl,
      displayName,
      taskTitle: args.taskTitle || args.requestText,
      humanTaskId: args.humanTaskId || null,
      sourceTool: args.tool,
      appEnv: resolveAppEnv(),
    });
    console.log(`[cursor-mcp] new_background_agent tracked session_id=${args.cursorAgentId} name="${displayName}"`);
  } catch (e) {
    console.error("[cursor-mcp] logDispatch failed:", (e as any)?.message ?? e);
  }
}

async function resolveDispatchMeta(
  tenantId: string | null,
  context: string,
  requestText: string,
  tool: string,
): Promise<{ humanTaskId: string | null; taskTitle: string | null; displayName: string }> {
  const humanTaskId = extractHumanTaskId(context);
  let taskTitle: string | null = null;
  const sb = sbClient();
  if (humanTaskId && tenantId && sb) {
    taskTitle = await fetchHumanTaskTitle(sb, tenantId, humanTaskId);
  }
  return {
    humanTaskId,
    taskTitle,
    displayName: cursorSessionDisplayName({ taskTitle, requestText, sourceTool: tool }),
  };
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
    `D) HUMAN TASK QUEUE: if Context includes human_task_id, call MCP tool complete_human_task when done (before or after the PR).\n` +
    `E) SAFETY (hard rules — see CLAUDE.md / AGENTS.md "Safety rules for autonomous fixes"): never widen anyone's access beyond their existing role/scope; ` +
    `no destructive or policy-widening SQL live (use a migration + PR); only safe scoped fixes autonomously. Log every autonomous prod change to ` +
    `public.claude_carmen_audit and report it. If a request would breach these, refuse and tell David.`
  );
}

function runtimeEnv(): Record<string, string | undefined> {
  try {
    return Deno.env.toObject();
  } catch {
    return {};
  }
}

async function resolveDirectSessionForReply(
  sessionIdArg: string,
  tenantId: string | null,
): Promise<CursorDirectSession> {
  const explicit = String(sessionIdArg || "").trim();
  if (explicit.startsWith("bc-")) {
    return {
      sessionId: explicit,
      sessionUrl: cursorSessionUrl(explicit),
      source: "arg:session_id",
    };
  }
  const fixed = await resolveCursorDirectSession(sbClient(), {
    tenantId,
    env: runtimeEnv(),
  });
  if (!fixed) throw new Error(missingCursorDirectSessionError());
  return fixed;
}

async function executeDirectSessionReply(args: {
  session: CursorDirectSession;
  message: string;
  context: string;
  originLabel: string;
  tenantId: string | null;
  agentId: string | null;
}): Promise<string> {
  const apiKey = Deno.env.get("CURSOR_API_KEY") || "";
  if (!apiKey) throw new Error("Cursor is not configured (set CURSOR_API_KEY secret).");

  const text =
    `${args.originLabel}\n` +
    `This is a reply in the fixed Cursor Direct chat — do not open a new Background Agent.\n\n` +
    `${args.message}\n` +
    (args.context ? `\nContext:\n${args.context}\n` : ``);

  console.log(
    `[cursor-mcp] direct_session_reply session_id=${args.session.sessionId} source=${args.session.source}`,
  );

  const followed = await followUpStickyAgent(apiKey, args.session.sessionId, text);
  if (!followed) {
    throw new Error(
      `Cursor Direct session ${args.session.sessionId} is gone (404/410). ` +
      `Update CURSOR_DIRECT_AGENT_ID or cursor_sticky_agents for this tenant.`,
    );
  }
  if (followed.delivered === false) {
    if (args.tenantId) {
      await touchCursorTaskSession(sbClient()!, args.session.sessionId, "busy");
    }
    throw new Error(
      `Cursor Direct session ${args.session.sessionId} is BUSY (only one run at a time). ` +
      `The message was NOT delivered. Retry when that run finishes: ${followed.url}. ` +
      `Do not call ask_cursor or request_dev_task — those open a new Background Agent.`,
    );
  }
  if (args.tenantId) {
    await touchCursorTaskSession(sbClient()!, args.session.sessionId, "running");
  }
  await logDispatch({
    tenantId: args.tenantId,
    agentId: args.agentId,
    tool: "reply_to_cursor_session",
    requestText: args.message,
    context: `direct_session_reply;source=${args.session.source};${args.session.sessionId}` +
      (args.context ? `\n${args.context}` : ""),
    branch: "",
    sessionUrl: followed.url,
    cursorAgentId: args.session.sessionId,
  });
  return (
    `✅ direct_session_reply — נשלח לצ׳אט Cursor הישיר (${args.session.source}) ${followed.url}`
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
    const meta = await resolveDispatchMeta(ctx.tenantId, context, task, "request_dev_task");
    const fired = await fireCursorAgent(text, {
      name: meta.displayName,
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
      sessionUrl: fired.url,
      cursorAgentId: fired.id,
      humanTaskId: meta.humanTaskId,
      taskTitle: meta.taskTitle,
      displayName: meta.displayName,
      reused: fired.reused,
    });
    return formatDispatchReply("dev task", fired);
  }

  if (name === "list_cursor_task_sessions") {
    const tenantId = ctx.tenantId || Deno.env.get("CURSOR_DEFAULT_TENANT_ID") || "";
    if (!tenantId) throw new Error("list_cursor_task_sessions requires a tenant context.");
    const sb = sbClient();
    if (!sb) throw new Error("Supabase not configured.");
    const statusRaw = String(args?.status || "active").trim().toLowerCase();
    const limit = Number(args?.limit || 20);
    const rows = await listCursorTaskSessions(sb, tenantId, {
      status: (statusRaw === "active" ? "active" : statusRaw) as any,
      limit: Number.isFinite(limit) ? limit : 20,
    });
    return formatCursorSessionsForAgent(rows);
  }

  if (name === "get_cursor_task_session") {
    const tenantId = ctx.tenantId || Deno.env.get("CURSOR_DEFAULT_TENANT_ID") || "";
    const taskId = String(args?.task_id ?? "").trim();
    if (!tenantId || !taskId) throw new Error("get_cursor_task_session requires task_id and tenant context.");
    const sb = sbClient();
    if (!sb) throw new Error("Supabase not configured.");
    const row = await findCursorSessionForTask(sb, tenantId, taskId);
    if (!row) {
      throw new Error(
        `No Cursor session tracked for task ${taskId}. ` +
        `Use list_cursor_task_sessions or assign the task to Cursor and dispatch again.`,
      );
    }
    return formatCursorSessionsForAgent([row]);
  }

  if (name === "complete_human_task") {
    const taskId = String(args?.task_id ?? "").trim();
    if (!taskId) throw new Error("complete_human_task requires task_id.");
    const summary = String(args?.summary ?? "").trim();
    const tenantId = ctx.tenantId || Deno.env.get("CURSOR_DEFAULT_TENANT_ID") || "";
    if (!tenantId) throw new Error("complete_human_task requires a tenant context.");
    const sb = sbClient();
    if (!sb) throw new Error("Supabase not configured.");
    const result = await completeHumanCursorTask(sb, { tenantId, taskId, summary });
    return result.advanced
      ? `✅ משימה ${taskId} הושלמה. המשימה הבאה בתור נשלחה ל-Cursor.`
      : `✅ משימה ${taskId} הושלמה.`;
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
    const meta = await resolveDispatchMeta(ctx.tenantId, context, request, "ask_cursor");
    const fired = await fireCursorAgent(text, {
      name: meta.displayName,
      tenantId: ctx.tenantId,
    });
    await logDispatch({
      tenantId: ctx.tenantId,
      agentId: ctx.agentId,
      tool: "ask_cursor",
      requestText: request,
      context,
      branch: "",
      sessionUrl: fired.url,
      cursorAgentId: fired.id,
      humanTaskId: meta.humanTaskId,
      taskTitle: meta.taskTitle,
      displayName: meta.displayName,
      reused: fired.reused,
    });
    return formatDispatchReply("request", fired);
  }

  if (name === "get_cursor_direct_session") {
    const fixed = await resolveCursorDirectSession(sbClient(), {
      tenantId: ctx.tenantId,
      env: runtimeEnv(),
    });
    if (!fixed) throw new Error(missingCursorDirectSessionError());
    console.log(
      `[cursor-mcp] get_cursor_direct_session session_id=${fixed.sessionId} source=${fixed.source}`,
    );
    return (
      `Fixed Cursor Direct session (read-only, no new Background Agent):\n` +
      `session_id: ${fixed.sessionId}\n` +
      `url: ${fixed.sessionUrl}\n` +
      `source: ${fixed.source}\n\n` +
      `For connection tests, call reply_to_cursor_session({ message: "…" }) ` +
      `or pass session_id explicitly. Do not use ask_cursor.`
    );
  }

  if (name === "reply_to_cursor_session") {
    const message = String(args?.message ?? "").trim();
    if (!message) throw new Error("reply_to_cursor_session requires a non-empty message.");
    const context = String(args?.context ?? "").trim();
    const session = await resolveDirectSessionForReply(
      String(args?.session_id ?? args?.bc_id ?? ""),
      ctx.tenantId,
    );
    return await executeDirectSessionReply({
      session,
      message,
      context,
      originLabel: "[Carmen / Grok → Cursor Direct]",
      tenantId: ctx.tenantId,
      agentId: ctx.agentId,
    });
  }

  if (name === "reply_to_aios_session") {
    const { ingestChannelReply } = await import("../_shared/agent-channel/ingest.ts");
    const conversationId = String(args?.conversation_id ?? "").trim();
    const content = String(args?.content ?? "").trim();
    if (!conversationId || !content) throw new Error("conversation_id and content are required");
    const result = await ingestChannelReply({
      conversation_id: conversationId,
      session_id: args?.session_id ? String(args.session_id) : undefined,
      origin: (args?.origin || "cursor") as any,
      content,
      idempotency_key: args?.idempotency_key ? String(args.idempotency_key) : undefined,
      tenant_id: ctx.tenantId || undefined,
    });
    return result.duplicate
      ? "Already delivered (idempotent). No duplicate message was created."
      : "Answer delivered to the AIOS Carmen conversation.";
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
          "JOB only. Follow standing skill (.cursor/skills/creative-direct and ai_skills.creative_direct). Do not ask to be re-briefed.",
          `Load APPROVED CONCEPTS from marketing_work_items id=${itemId}. Photograph the concept. Type the copy.`,
          copyLabel && `Copy variation «${copyLabel}».`,
          directorNote && `DIRECTOR / REJECT: ${directorNote}`,
        ].filter(Boolean).join("\n"),
        lesson: directorNote || undefined,
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
      `✅ נשלח לקריאייטיב דיירקט (אותו צ׳אט דביק)` +
      (data.agent_url ? `\nSession: ${data.agent_url}` : "") +
      `\nהתמונה תופיע על פרויקט הקריאייטיב אחרי שהצ׳אט מעלה אותה.`
    );
  }

  throw new Error(`Unknown tool: ${name}`);
}

type RpcCtx = { tenantId: string | null; agentId: string | null; grokMode: boolean };

async function handleRpcMessage(
  msg: McpRpcMessage,
  ctx: RpcCtx,
  bearer: string | undefined,
): Promise<Response> {
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
        try {
          const callCtx = ctx.tenantId || ctx.agentId
            ? { tenantId: ctx.tenantId, agentId: ctx.agentId }
            : await resolveContext(bearer);
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
    console.error("[cursor-mcp]", e?.message ?? e);
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
        streamable_http: CURSOR_MCP_STREAMABLE_URL,
        setup: "Grok Bot direct → /mcp + GROK_CURSOR_MCP_BEARER. Carmen → /cursor-mcp + CURSOR_MCP_BEARER.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const bearer = bearerFrom(req);
  if (!isAuthorizedBearer(bearer)) {
    if (streamable) {
      return handleStreamableMcpRequest(req, async (msg) =>
        rpcError(msg.id, -32001, "Unauthorized: invalid or missing bearer token", 401));
    }
    return rpcError(null, -32001, "Unauthorized: invalid or missing bearer token", 401);
  }

  const ctx: RpcCtx = {
    tenantId: null,
    agentId: null,
    grokMode: streamable,
  };

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
