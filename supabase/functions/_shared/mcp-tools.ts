// MCP tools loader for run-ai-agent.
// Loads ready MCP connections (tenant + optional agent scope) and exposes
// AI-Gateway compatible tool definitions plus per-tool executors that call
// the remote MCP server via JSON-RPC over HTTP.

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

async function mcpJsonRpc(url: string, bearer: string | undefined, method: string, params: any = {}, id = 1) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream',
  }
  if (bearer) headers['Authorization'] = `Bearer ${bearer}`
  const resp = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
  })
  const text = await resp.text()
  if (!resp.ok) throw new Error(`MCP ${method} ${resp.status}: ${text.slice(0, 400)}`)
  const ct = resp.headers.get('content-type') ?? ''
  if (ct.includes('text/event-stream')) {
    const m = text.match(/data:\s*(\{[\s\S]+?\})\s*$/m)
    if (m) return JSON.parse(m[1])
  }
  return JSON.parse(text)
}

function sanitizeToolName(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60)
}

export async function loadMcpTools(
  supabase: any,
  tenantId: string,
  agentId?: string | null,
): Promise<McpLoaded> {
  const empty: McpLoaded = { toolDefs: [], executors: new Map(), connectionsCount: 0 }
  if (!tenantId) return empty

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
    const tools = Array.isArray(conn.available_tools) ? conn.available_tools : []
    const bearer = conn.oauth_tokens?.bearer as string | undefined
    const connSlug = sanitizeToolName(conn.name || conn.id.slice(0, 6))

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
        const resp = await mcpJsonRpc(conn.url, bearer, 'tools/call', {
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
