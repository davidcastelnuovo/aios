import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import {
  compactToolsForGrok,
  grokCompatibleInitializeResult,
  handleStreamableMcpRequest,
  isStreamableMcpPath,
  wantsStreamableHttp,
  type McpRpcMessage,
} from "../_shared/mcp-streamable-http.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const SERVER_INFO = { name: "aios-collaboration-mcp", version: "1.0.0" };
const PROTOCOL_VERSION = "2024-11-05";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, accept, mcp-session-id, mcp-protocol-version",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Expose-Headers": "Mcp-Session-Id",
};

const TOOLS = [
  {
    name: "register_agent",
    description:
      "Register or heartbeat an AIOS teammate (codex, cursor, carmen, or grok).",
    inputSchema: {
      type: "object",
      properties: {
        agent: { type: "string" },
        display_name: { type: "string" },
        capabilities: { type: "array", items: { type: "string" } },
        status: { type: "string", enum: ["online", "busy", "offline"] },
        metadata: { type: "object" },
      },
      required: ["agent"],
    },
  },
  {
    name: "list_agents",
    description: "List teammates and their current task/last heartbeat.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "create_task",
    description:
      "Create one shared task. Agents should claim it before working to prevent duplication.",
    inputSchema: {
      type: "object",
      properties: {
        agent: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        priority: { type: "string", enum: ["low", "normal", "high", "urgent"] },
        assigned_to: { type: "string" },
        branch: { type: "string" },
        acceptance_criteria: { type: "array", items: { type: "string" } },
        metadata: { type: "object" },
      },
      required: ["agent", "title"],
    },
  },
  {
    name: "list_tasks",
    description: "List shared tasks filtered by status or assignee.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string" },
        assigned_to: { type: "string" },
        limit: { type: "number" },
      },
    },
  },
  {
    name: "claim_task",
    description:
      "Atomically claim an open task for an agent. Fails if another agent already owns it.",
    inputSchema: {
      type: "object",
      properties: { task_id: { type: "string" }, agent: { type: "string" } },
      required: ["task_id", "agent"],
    },
  },
  {
    name: "update_task",
    description: "Update progress, result links or task status.",
    inputSchema: {
      type: "object",
      properties: {
        task_id: { type: "string" },
        agent: { type: "string" },
        status: {
          type: "string",
          enum: ["in_progress", "blocked", "review", "completed", "cancelled"],
        },
        message: { type: "string" },
        pull_request_url: { type: "string" },
        preview_url: { type: "string" },
        metadata: { type: "object" },
      },
      required: ["task_id", "agent", "status"],
    },
  },
  {
    name: "handoff_task",
    description: "Transfer an owned task to another teammate with context.",
    inputSchema: {
      type: "object",
      properties: {
        task_id: { type: "string" },
        from_agent: { type: "string" },
        to_agent: { type: "string" },
        message: { type: "string" },
      },
      required: ["task_id", "from_agent", "to_agent", "message"],
    },
  },
  {
    name: "send_message",
    description:
      "Send a task-linked or direct message to one teammate, or broadcast when recipient is omitted.",
    inputSchema: {
      type: "object",
      properties: {
        sender: { type: "string" },
        recipient: { type: "string" },
        task_id: { type: "string" },
        message_type: {
          type: "string",
          enum: [
            "message",
            "status",
            "handoff",
            "review_request",
            "result",
            "error",
          ],
        },
        body: { type: "string" },
        metadata: { type: "object" },
      },
      required: ["sender", "body"],
    },
  },
  {
    name: "get_messages",
    description: "Read an agent inbox and mark returned messages as read.",
    inputSchema: {
      type: "object",
      properties: {
        agent: { type: "string" },
        since: { type: "string" },
        task_id: { type: "string" },
        limit: { type: "number" },
      },
      required: ["agent"],
    },
  },
];

function sb() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY)
    throw new Error("Supabase service configuration is missing.");
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

function bearerFrom(req: Request): string | undefined {
  const match = (req.headers.get("authorization") || "").match(
    /^Bearer\s+(.+)$/i,
  );
  return match?.[1]?.trim();
}

function acceptedBearers(): string[] {
  return [
    "COLLABORATION_MCP_BEARER",
    "CURSOR_MCP_BEARER",
    "GROK_MCP_BEARER",
    "CARMEN_MCP_BEARER",
  ]
    .map((key) => Deno.env.get(key) || "")
    .filter(Boolean);
}

function authorized(bearer?: string): boolean {
  const allowed = acceptedBearers();
  return allowed.length > 0 && !!bearer && allowed.includes(bearer);
}

async function tenantForBearer(bearer?: string): Promise<string | null> {
  if (bearer) {
    const { data } = await sb()
      .from("agent_mcp_connections")
      .select("tenant_id")
      .eq("state", "ready")
      .filter("oauth_tokens->>bearer", "eq", bearer);
    const tenants = [
      ...new Set(
        (data || [])
          .map((row: { tenant_id: string | null }) => row.tenant_id)
          .filter(Boolean),
      ),
    ];
    if (tenants.length === 1) return tenants[0] as string;
  }
  return (
    Deno.env.get("COLLABORATION_DEFAULT_TENANT_ID") ||
    Deno.env.get("CURSOR_DEFAULT_TENANT_ID") ||
    null
  );
}

function cleanAgent(value: unknown): string {
  const agent = String(value || "")
    .trim()
    .toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]{1,63}$/.test(agent))
    throw new Error("Invalid agent key.");
  return agent;
}

function json(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

async function insertMessage(
  tenantId: string | null,
  args: Record<string, unknown>,
) {
  const row = {
    tenant_id: tenantId,
    task_id: args.task_id || null,
    sender: cleanAgent(args.sender),
    recipient: args.recipient ? cleanAgent(args.recipient) : null,
    message_type: String(args.message_type || "message"),
    body: String(args.body || "").trim(),
    metadata:
      args.metadata && typeof args.metadata === "object" ? args.metadata : {},
  };
  if (!row.body) throw new Error("Message body is required.");
  const { data, error } = await sb()
    .from("agent_collaboration_messages")
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function callTool(
  name: string,
  args: Record<string, unknown>,
  tenantId: string | null,
): Promise<string> {
  const client = sb();
  const scopeAgent = (query: any, agent: string) => {
    const scoped = query.eq("agent_key", agent);
    return tenantId
      ? scoped.eq("tenant_id", tenantId)
      : scoped.is("tenant_id", null);
  };
  if (name === "register_agent") {
    const agent = cleanAgent(args.agent);
    const row = {
      tenant_id: tenantId,
      agent_key: agent,
      display_name: String(args.display_name || agent),
      capabilities: Array.isArray(args.capabilities)
        ? args.capabilities.map(String)
        : [],
      status: String(args.status || "online"),
      metadata: args.metadata || {},
      last_seen_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await client
      .from("agent_collaboration_agents")
      .upsert(row, { onConflict: "tenant_id,agent_key" })
      .select()
      .single();
    if (error) throw error;
    return json(data);
  }
  if (name === "list_agents") {
    let query = client
      .from("agent_collaboration_agents")
      .select("*")
      .order("last_seen_at", { ascending: false });
    query = tenantId
      ? query.eq("tenant_id", tenantId)
      : query.is("tenant_id", null);
    const { data, error } = await query;
    if (error) throw error;
    return json(data);
  }
  if (name === "create_task") {
    const createdBy = cleanAgent(args.agent);
    const title = String(args.title || "").trim();
    if (!title) throw new Error("Task title is required.");
    const assigned = args.assigned_to ? cleanAgent(args.assigned_to) : null;
    const { data, error } = await client
      .from("agent_collaboration_tasks")
      .insert({
        tenant_id: tenantId,
        title,
        description: String(args.description || ""),
        priority: String(args.priority || "normal"),
        created_by: createdBy,
        assigned_to: assigned,
        branch: args.branch || null,
        acceptance_criteria: Array.isArray(args.acceptance_criteria)
          ? args.acceptance_criteria.map(String)
          : [],
        metadata: args.metadata || {},
      })
      .select()
      .single();
    if (error) throw error;
    return json(data);
  }
  if (name === "list_tasks") {
    let query = client
      .from("agent_collaboration_tasks")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(Math.min(Number(args.limit || 50), 100));
    query = tenantId
      ? query.eq("tenant_id", tenantId)
      : query.is("tenant_id", null);
    if (args.status) query = query.eq("status", String(args.status));
    if (args.assigned_to)
      query = query.eq("assigned_to", cleanAgent(args.assigned_to));
    const { data, error } = await query;
    if (error) throw error;
    return json(data);
  }
  if (name === "claim_task") {
    const agent = cleanAgent(args.agent);
    let query = client
      .from("agent_collaboration_tasks")
      .update({
        assigned_to: agent,
        status: "claimed",
        claimed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", String(args.task_id))
      .eq("status", "open")
      .or(`assigned_to.is.null,assigned_to.eq.${agent}`);
    query = tenantId
      ? query.eq("tenant_id", tenantId)
      : query.is("tenant_id", null);
    const { data, error } = await query.select().maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Task is unavailable or already claimed.");
    await scopeAgent(
      client.from("agent_collaboration_agents").update({
        current_task_id: data.id,
        status: "busy",
        last_seen_at: new Date().toISOString(),
      }),
      agent,
    );
    return json(data);
  }
  if (name === "update_task") {
    const agent = cleanAgent(args.agent);
    const status = String(args.status);
    const patch: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };
    if (args.pull_request_url)
      patch.pull_request_url = String(args.pull_request_url);
    if (args.preview_url) patch.preview_url = String(args.preview_url);
    if (args.metadata) patch.metadata = args.metadata;
    if (status === "completed") patch.completed_at = new Date().toISOString();
    let query = client
      .from("agent_collaboration_tasks")
      .update(patch)
      .eq("id", String(args.task_id))
      .eq("assigned_to", agent);
    query = tenantId
      ? query.eq("tenant_id", tenantId)
      : query.is("tenant_id", null);
    const { data, error } = await query.select().maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Task not found or agent does not own it.");
    if (args.message)
      await insertMessage(tenantId, {
        task_id: data.id,
        sender: agent,
        message_type: status === "completed" ? "result" : "status",
        body: args.message,
      });
    if (["completed", "cancelled"].includes(status))
      await scopeAgent(
        client
          .from("agent_collaboration_agents")
          .update({ current_task_id: null, status: "online" }),
        agent,
      );
    return json(data);
  }
  if (name === "handoff_task") {
    const from = cleanAgent(args.from_agent);
    const to = cleanAgent(args.to_agent);
    let query = client
      .from("agent_collaboration_tasks")
      .update({
        assigned_to: to,
        status: "claimed",
        claimed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", String(args.task_id))
      .eq("assigned_to", from);
    query = tenantId
      ? query.eq("tenant_id", tenantId)
      : query.is("tenant_id", null);
    const { data, error } = await query.select().maybeSingle();
    if (error) throw error;
    if (!data)
      throw new Error("Task not found or source agent does not own it.");
    await insertMessage(tenantId, {
      task_id: data.id,
      sender: from,
      recipient: to,
      message_type: "handoff",
      body: args.message,
    });
    await scopeAgent(
      client
        .from("agent_collaboration_agents")
        .update({ current_task_id: null, status: "online" }),
      from,
    );
    await scopeAgent(
      client
        .from("agent_collaboration_agents")
        .update({ current_task_id: data.id, status: "busy" }),
      to,
    );
    return json(data);
  }
  if (name === "send_message") return json(await insertMessage(tenantId, args));
  if (name === "get_messages") {
    const agent = cleanAgent(args.agent);
    const limit = Math.min(Number(args.limit || 50), 100);
    let query = client
      .from("agent_collaboration_messages")
      .select("*")
      .or(`recipient.eq.${agent},recipient.is.null`)
      .order("created_at", { ascending: true })
      .limit(limit);
    query = tenantId
      ? query.eq("tenant_id", tenantId)
      : query.is("tenant_id", null);
    if (args.since) query = query.gt("created_at", String(args.since));
    if (args.task_id) query = query.eq("task_id", String(args.task_id));
    const { data, error } = await query;
    if (error) throw error;
    const unread = (data || []).filter(
      (m: { read_by?: string[] }) => !(m.read_by || []).includes(agent),
    );
    await Promise.all(
      unread.map((m: { id: string; read_by?: string[] }) =>
        client
          .from("agent_collaboration_messages")
          .update({ read_by: [...(m.read_by || []), agent] })
          .eq("id", m.id),
      ),
    );
    return json(data);
  }
  throw new Error(`Unknown tool: ${name}`);
}

function rpcResult(id: unknown, result: unknown) {
  return new Response(
    JSON.stringify({ jsonrpc: "2.0", id: id ?? null, result }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}
function rpcError(id: unknown, code: number, message: string, status = 200) {
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      id: id ?? null,
      error: { code, message },
    }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

async function dispatch(
  message: McpRpcMessage,
  ctx: { grokMode: boolean; tenantId: string | null },
): Promise<Response> {
  try {
    if (message.method === "initialize") {
      const clientProtocol =
        typeof message.params?.protocolVersion === "string"
          ? message.params.protocolVersion
          : undefined;
      return rpcResult(
        message.id,
        ctx.grokMode
          ? grokCompatibleInitializeResult(clientProtocol, SERVER_INFO)
          : {
              protocolVersion: PROTOCOL_VERSION,
              capabilities: { tools: {} },
              serverInfo: SERVER_INFO,
            },
      );
    }
    if (message.method === "notifications/initialized")
      return new Response(null, { status: 202, headers: corsHeaders });
    if (message.method === "tools/list")
      return rpcResult(message.id, {
        tools: ctx.grokMode ? compactToolsForGrok(TOOLS) : TOOLS,
      });
    if (message.method === "tools/call") {
      const params = (message.params || {}) as Record<string, unknown>;
      const text = await callTool(
        String(params.name || ""),
        (params.arguments || {}) as Record<string, unknown>,
        ctx.tenantId,
      );
      return rpcResult(message.id, {
        content: [{ type: "text", text }],
        isError: false,
      });
    }
    return rpcError(message.id, -32601, `Method not found: ${message.method}`);
  } catch (error) {
    return rpcResult(message.id, {
      content: [
        {
          type: "text",
          text: error instanceof Error ? error.message : String(error),
        },
      ],
      isError: true,
    });
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });
  const bearer = bearerFrom(req);
  if (!authorized(bearer)) return rpcError(null, -32001, "Unauthorized", 401);
  const tenantId = await tenantForBearer(bearer);
  const pathname = new URL(req.url).pathname;
  if (isStreamableMcpPath(pathname) || wantsStreamableHttp(req, pathname)) {
    const grokMode = (req.headers.get("user-agent") || "")
      .toLowerCase()
      .includes("grok");
    return handleStreamableMcpRequest(req, (message) =>
      dispatch(message, { grokMode, tenantId }),
    );
  }
  if (req.method === "GET")
    return new Response(
      JSON.stringify({
        ok: true,
        server: SERVER_INFO,
        tools: TOOLS.map((tool) => tool.name),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  if (req.method !== "POST")
    return rpcError(null, -32600, "POST required", 405);
  return dispatch((await req.json()) as McpRpcMessage, {
    grokMode: false,
    tenantId,
  });
});
