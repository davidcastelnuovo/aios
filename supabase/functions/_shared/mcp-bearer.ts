// Shared helpers for internal AIOS MCP edge connections (Cursor, Claude, Grok, Manus).
// Keeps agent_mcp_connections.oauth_tokens.bearer aligned with Edge secrets when they drift.

export const PRESET_SECRETS: Record<string, string> = {
  cursor: "CURSOR_MCP_BEARER",
  grok: "GROK_MCP_BEARER",
  claude: "CLAUDE_MCP_BEARER",
  manus: "MANUS_MCP_BEARER",
};

export interface McpProbeResult {
  tools: any[];
  state: "ready" | "failed";
  lastError: string | null;
}

export function secretForConnectionName(name: string): string | undefined {
  const key = PRESET_SECRETS[name.trim().toLowerCase()];
  if (!key) return undefined;
  return Deno.env.get(key) || undefined;
}

export function isInternalMcpUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.hostname.endsWith(".supabase.co") && u.pathname.includes("/functions/v1/");
  } catch {
    return false;
  }
}

export async function mcpJsonRpc(
  url: string,
  bearer: string | undefined,
  method: string,
  params: any = {},
  id = 1,
): Promise<any> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };
  if (bearer) headers.Authorization = `Bearer ${bearer}`;
  const resp = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
    signal: AbortSignal.timeout(12_000),
  });
  const text = await resp.text();
  if (!resp.ok) {
    const err = new Error(`MCP ${method} ${resp.status}: ${text.slice(0, 400)}`) as Error & { status?: number };
    err.status = resp.status;
    throw err;
  }
  const ct = resp.headers.get("content-type") ?? "";
  if (ct.includes("text/event-stream")) {
    const m = text.match(/data:\s*(\{[\s\S]+?\})\s*$/m);
    if (m) return JSON.parse(m[1]);
  }
  return JSON.parse(text);
}

export async function probeMcp(url: string, bearer: string | undefined): Promise<McpProbeResult> {
  let tools: any[] = [];
  let state: McpProbeResult["state"] = "ready";
  let lastError: string | null = null;
  try {
    await mcpJsonRpc(url, bearer, "initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "marketing-captain", version: "1.0.0" },
    });
    const listResp = await mcpJsonRpc(url, bearer, "tools/list");
    tools = listResp?.result?.tools ?? [];
  } catch (e: any) {
    state = "failed";
    lastError = String(e?.message ?? e);
  }
  return { tools, state, lastError };
}

export function isMcpAuthError(err: unknown): boolean {
  const msg = String((err as any)?.message ?? err ?? "");
  const status = (err as any)?.status;
  return status === 401 || status === 403 || /401|403|Unauthorized|invalid or missing bearer/i.test(msg);
}

export async function resyncInternalMcpBearer(
  supabase: any,
  conn: { id: string; name: string; url: string; tenant_id?: string | null },
): Promise<{ bearer: string; tools: any[]; state: McpProbeResult["state"]; lastError: string | null } | null> {
  if (!isInternalMcpUrl(conn.url)) return null;
  const bearer = secretForConnectionName(conn.name);
  if (!bearer) return null;

  const { tools, state, lastError } = await probeMcp(conn.url, bearer);
  const update: Record<string, unknown> = {
    oauth_tokens: { bearer },
    available_tools: tools,
    state,
    last_error: lastError,
    updated_at: new Date().toISOString(),
  };
  let q = supabase.from("agent_mcp_connections").update(update).eq("id", conn.id);
  if (conn.tenant_id) q = q.eq("tenant_id", conn.tenant_id);
  const { error } = await q;
  if (error) throw error;
  return { bearer, tools, state, lastError };
}
