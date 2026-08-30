// MCP tools loader for run-ai-agent.
// Loads ready MCP connections (tenant + optional agent scope) and exposes
// AI-Gateway compatible tool definitions plus per-tool executors that call
// the remote MCP server via JSON-RPC over HTTP.

import {
  isMcpAuthError,
  mcpJsonRpc,
  resyncInternalMcpBearer,
} from "./mcp-bearer.ts";

export interface McpLoaded {
  toolDefs: Array<{ name: string; description?: string; parameters: any }>
  executors: Map<string, (args: any) => Promise<any>>
  connectionsCount: number
}

interface McpConnRow {
  id: string
  name: string
  url: string
  state: string
  oauth_tokens: any
  available_tools: any
}

function sanitizeToolName(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60)
}

function toolNames(list: any[]): string {
  return (list || []).map((t) => t?.name).filter(Boolean).sort().join(',')
}

async function callMcpWithResync(
  supabase: any,
  conn: McpConnRow,
  tenantId: string,
  method: string,
  params: any = {},
  id = 1,
): Promise<{ resp: any; bearer: string | undefined }> {
  let bearer = conn.oauth_tokens?.bearer as string | undefined;
  try {
    return { resp: await mcpJsonRpc(conn.url, bearer, method, params, id), bearer };
  } catch (e) {
    if (!isMcpAuthError(e)) throw e;
    console.warn(`[mcp-tools] ${method} auth failed for ${conn.name}, resyncing bearer from edge secret`);
    const resynced = await resyncInternalMcpBearer(supabase, {
      id: conn.id,
      name: conn.name,
      url: conn.url,
      tenant_id: tenantId,
    });
    if (!resynced?.bearer) throw e;
    bearer = resynced.bearer;
    conn.oauth_tokens = { bearer };
    conn.available_tools = resynced.tools;
    conn.state = resynced.state;
    return { resp: await mcpJsonRpc(conn.url, bearer, method, params, id), bearer };
  }
}

async function toolsForConnection(
  supabase: any,
  tenantId: string,
  conn: McpConnRow,
): Promise<any[]> {
  const cached = Array.isArray(conn.available_tools) ? conn.available_tools : []
  try {
    const { resp } = await callMcpWithResync(supabase, conn, tenantId, 'tools/list')
    const live = resp?.result?.tools
    if (Array.isArray(live) && live.length > 0) return live
  } catch (e) {
    console.warn(`[mcp-tools] tools/list failed for ${conn.name}:`, (e as any)?.message ?? e)
  }
  return cached
}

export async function loadMcpTools(
  supabase: any,
  tenantId: string,
  agentId?: string | null,
  disabledIntegrations: string[] = [],
): Promise<McpLoaded> {
  const empty: McpLoaded = { toolDefs: [], executors: new Map(), connectionsCount: 0 }
  if (!tenantId) return empty
  const disabledSet = new Set((disabledIntegrations || []).map((s) => String(s)))

  let q = supabase
    .from('agent_mcp_connections')
    .select('id, name, url, state, oauth_tokens, available_tools')
    .eq('tenant_id', tenantId)
    .eq('state', 'ready')
  // Include tenant-wide (agent_id null) + this agent's
  if (agentId) {
    q = q.or(`agent_id.eq.${agentId},agent_id.is.null`)
  } else {
    q = q.is('agent_id', null)
  }
  const { data, error } = await q
  if (error || !data?.length) return empty

  const toolDefs: McpLoaded['toolDefs'] = []
  const executors = new Map<string, (args: any) => Promise<any>>()

  for (const conn of data as McpConnRow[]) {
    // Access control: skip integrations turned OFF for this agent.
    if (disabledSet.has(conn.name)) continue
    const tools = await toolsForConnection(supabase, tenantId, conn)
    let bearer = conn.oauth_tokens?.bearer as string | undefined
    const connSlug = sanitizeToolName(conn.name || conn.id.slice(0, 6))

    if (toolNames(tools) !== toolNames(Array.isArray(conn.available_tools) ? conn.available_tools : [])) {
      try {
        await supabase
          .from('agent_mcp_connections')
          .update({ available_tools: tools, last_error: null, updated_at: new Date().toISOString() })
          .eq('id', conn.id)
          .eq('tenant_id', tenantId)
      } catch (e) {
        console.warn('[mcp-tools] cache refresh failed:', (e as any)?.message ?? e)
      }
    }

    for (const t of tools) {
      if (!t?.name) continue
      const prefixed = sanitizeToolName(`mcp_${connSlug}__${t.name}`)
      if (executors.has(prefixed)) continue
      toolDefs.push({
        name: prefixed,
        description: `[MCP:${conn.name}] ${t.description || t.name}`.slice(0, 1000),
        parameters: t.inputSchema || t.input_schema || { type: 'object', properties: {} },
      })
      const remoteName = t.name as string
      executors.set(prefixed, async (args: any) => {
        const { resp } = await callMcpWithResync(supabase, conn, tenantId, 'tools/call', {
          name: remoteName,
          arguments: args ?? {},
        })
        if (resp?.error) {
          throw new Error(`MCP ${conn.name}/${remoteName}: ${resp.error.message || JSON.stringify(resp.error)}`)
        }
        const content = resp?.result?.content
        // Flatten common content shapes to plain text/json for the model.
        if (Array.isArray(content)) {
          const parts = content.map((c: any) => c?.text ?? c?.data ?? c).filter(Boolean)
          return parts.length === 1 ? parts[0] : parts
        }
        return resp?.result ?? resp
      })
    }
  }

  return { toolDefs, executors, connectionsCount: data.length }
}
