// Shared helpers for internal AIOS MCP edge connections (Cursor, Claude, Grok, Manus).
// Preview/Staging: resync also repoints cloned prod MCP URLs to this project's host.
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

const PRESET_FUNCTION_SLUGS: Record<string, string> = {
  cursor: "cursor-mcp",
  grok: "grok-mcp",
  claude: "claude-mcp",
  manus: "manus-mcp",
};

/** Carmen preset URLs should target this project's edge function, not a cloned prod host. */
export function canonicalInternalMcpUrl(
  connectionName: string,
  supabaseUrl = Deno.env.get("SUPABASE_URL") || "",
): string | null {
  const slug = PRESET_FUNCTION_SLUGS[connectionName.trim().toLowerCase()];
  if (!slug || !supabaseUrl.startsWith("https://")) return null;
  return `${supabaseUrl.replace(/\/$/, "")}/functions/v1/${slug}`;
}

export function repointInternalMcpUrlIfNeeded(
  connectionName: string,
  currentUrl: string,
  supabaseUrl = Deno.env.get("SUPABASE_URL") || "",
): string {
  const canonical = canonicalInternalMcpUrl(connectionName, supabaseUrl);
  if (!canonical || !isInternalMcpUrl(currentUrl)) return currentUrl;
  try {
    const cur = new URL(currentUrl);
    const next = new URL(canonical);
    if (cur.hostname === next.hostname && cur.pathname === next.pathname) return currentUrl;
    return canonical;
  } catch {
    return currentUrl;
  }
}

/** Short RPC (initialize / tools/list). tools/call uses the longer budget below. */
export const MCP_RPC_TIMEOUT_DEFAULT_MS = 12_000;
/**
 * Cursor/Claude/Grok agent create + sticky follow-up often exceeds 12s.
 * A short client abort made Carmen report "Cursor didn't receive" while the
 * edge function kept running and successfully opened a bc- session.
 */
export const MCP_RPC_TIMEOUT_TOOLS_CALL_MS = 90_000;

export function mcpRpcTimeoutMs(method: string, overrideMs?: number): number {
  if (typeof overrideMs === "number" && overrideMs > 0) return overrideMs;
  return method === "tools/call" ? MCP_RPC_TIMEOUT_TOOLS_CALL_MS : MCP_RPC_TIMEOUT_DEFAULT_MS;
}

export function isMcpTimeoutError(err: unknown): boolean {
  const name = String((err as any)?.name ?? "");
  const msg = String((err as any)?.message ?? err ?? "").toLowerCase();
  return name === "TimeoutError" || name === "AbortError" ||
    msg.includes("timed out") || msg.includes("timeout") || msg.includes("aborted");
}

export async function mcpJsonRpc(
  url: string,
  bearer: string | undefined,
  method: string,
  params: any = {},
  id = 1,
  timeoutMs?: number,
): Promise<any> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };
  if (bearer) headers.Authorization = `Bearer ${bearer}`;
  const ms = mcpRpcTimeoutMs(method, timeoutMs);
  const resp = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
    signal: AbortSignal.timeout(ms),
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
): Promise<{ bearer: string; tools: any[]; state: McpProbeResult["state"]; lastError: string | null; url?: string } | null> {
  if (!isInternalMcpUrl(conn.url) && !canonicalInternalMcpUrl(conn.name)) return null;
  const bearer = secretForConnectionName(conn.name);
  if (!bearer) return null;

  const url = repointInternalMcpUrlIfNeeded(conn.name, conn.url);
  const { tools, state, lastError } = await probeMcp(url, bearer);
  const update: Record<string, unknown> = {
    url,
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
  conn.url = url;
  return { bearer, tools, state, lastError, url };
}
