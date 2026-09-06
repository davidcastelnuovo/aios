/**
 * Carmen token optimizer — lazy context loading for run-ai-agent.
 *
 * Goals:
 * - Acknowledge the request immediately (status SSE).
 * - Inject only task-relevant memory (semantic pointers, instructions only).
 * - Route tools via embedding index instead of shipping the full ~140-tool set.
 * - Defer MCP tool schemas until the query matches a connection.
 */

import { aiEmbed, aiEmbedBatch } from './ai.ts'

export function shouldUseTokenOptimize(agent: { metadata?: Record<string, unknown> | null }, isCarmen: boolean): boolean {
  if (!isCarmen) return false
  if (agent?.metadata?.token_optimize === false) return false
  return true
}

/** Always available in lazy mode — memory, search, task basics, tool discovery. */
export const LAZY_BOOTSTRAP_TOOLS = new Set([
  'search_agent_tools',
  'save_memory', 'recall_memory', 'recall_memory_fts', 'delete_memory',
  'kb_search', 'kb_open', 'kb_list_folder',
  'search_entities', 'list_clients', 'list_leads',
  'search_tasks', 'list_tasks', 'create_task', 'update_task', 'create_agent_task',
  'execute_pending_approval', 'reject_pending_approval', 'list_pending_approvals',
  'recall_recent_action', 'record_action_episode',
  'get_latest_campaign_pulse',
])

/** Extra tools unioned after embedding match in lazy mode (smaller than legacy CORE_TOOLS). */
export const LAZY_ROUTED_CORE = new Set([
  'send_message', 'send_whatsapp_to_staff', 'lookup_staff_whatsapp', 'send_message_to_campaigner',
  'list_campaigners', 'list_sales_people',
  'get_client_info', 'get_dashboard_stats',
  'inspect_facebook_ad', 'fb_duplicate_ad_variants', 'duplicate_facebook_ad_variants',
  'list_facebook_ads', 'analyze_facebook_campaign', 'toggle_facebook_campaign',
  'join_meeting_for_client', 'get_meeting_bot_status',
])

export const LAZY_ROUTER_MATCH_COUNT = 22
export const LEGACY_ROUTER_MATCH_COUNT = 55
export const ROUTER_ACTIVATE_MIN = 90

export function buildQuickAck(commandText: string): string {
  const t = String(commandText || '').trim()
  if (!t) return 'קיבלתי, עובדת על זה.'
  if (t.length > 120) return 'קיבלתי את המשימה, עובדת עליה.'
  return `קיבלתי — "${t.slice(0, 80)}${t.length > 80 ? '…' : ''}"`
}

export function toolSig(s: string): string {
  let h = 5381
  const str = s || ''
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

export async function ensureToolEmbeddings(supabase: any, toolDefs: Array<{ name: string; description?: string }>): Promise<void> {
  const { data: existing } = await supabase.from('agent_tool_embeddings').select('tool_name, sig')
  const have = new Map<string, string>((existing || []).map((r: any) => [r.tool_name, r.sig]))
  const missing = toolDefs.filter((t) => have.get(t.name) !== toolSig(t.description || ''))
  if (missing.length === 0) return
  const vectors = await aiEmbedBatch(missing.map((t) => `${t.name}: ${t.description || ''}`))
  if (!vectors) return
  const rows = missing.map((t, i) => ({
    tool_name: t.name,
    sig: toolSig(t.description || ''),
    embedding: vectors[i],
    updated_at: new Date().toISOString(),
  }))
  await supabase.from('agent_tool_embeddings').upsert(rows, { onConflict: 'tool_name' })
}

export async function matchToolNames(
  supabase: any,
  queryText: string,
  matchCount: number,
): Promise<string[]> {
  const qvec = await aiEmbed(queryText)
  if (!qvec) return []
  const { data } = await supabase.rpc('match_agent_tools', {
    query_embedding: qvec,
    match_count: matchCount,
  })
  return (data || []).map((r: any) => r.tool_name).filter(Boolean)
}

export type ForceIncludeFn = (userText: string, picked: Set<string>) => void

/** Keyword / phrase rules shared by the router and search_agent_tools. */
export function applyToolForceIncludes(userText: string, picked: Set<string>, helpers: {
  isExplicitApprovalPhrase: (t: string) => boolean
  isExplicitRejectionPhrase: (t: string) => boolean
  extractMeetingUrl: (t: string) => string | null
}): void {
  if (/(שכפל|שכפול|וריאצ|קופי|duplicate\s*ad|copy\s*variant|ad\s*variant|inspect.?ad)/i.test(userText)) {
    for (const n of ['inspect_facebook_ad', 'fb_duplicate_ad_variants', 'duplicate_facebook_ad_variants',
      'list_facebook_ads', 'analyze_facebook_campaign', 'execute_pending_approval',
      'reject_pending_approval', 'list_pending_approvals']) picked.add(n)
  }
  if (helpers.isExplicitApprovalPhrase(userText) || helpers.isExplicitRejectionPhrase(userText)) {
    for (const n of ['execute_pending_approval', 'reject_pending_approval', 'list_pending_approvals',
      'fb_duplicate_ad_variants', 'duplicate_facebook_ad_variants', 'toggle_facebook_campaign', 'inspect_facebook_ad']) {
      picked.add(n)
    }
  }
  if (helpers.extractMeetingUrl(userText)) {
    picked.add('join_meeting_for_client')
    picked.add('get_meeting_bot_status')
  }
  if (/(שלח.*(וואטסאפ|whatsapp|הודע).*(קמפיינר|איש מכירות|צוות|עובד|אנה)|whatsapp.*(staff|campaigner|sales|team)|שלח.*(לאנה|לקמפיינר|לאיש מכירות)|lookup_staff|send_whatsapp_to_staff)/i.test(userText)) {
    for (const n of ['send_whatsapp_to_staff', 'lookup_staff_whatsapp', 'send_message_to_campaigner',
      'list_campaigners', 'list_sales_people', 'search_entities']) picked.add(n)
  }
  if (/\bדופק\b|\bpulse\s*check\b|בדיקת\s*דוח|מצב\s*קמפיינים|סיכום\s*קמפיינים/i.test(userText)) {
    picked.add('get_latest_campaign_pulse')
  }
  if (/(openai|open ai|קרדיט|יתרת|billing|usage|חיוב|כמה.*(נשאר|עולה|הוצא)|api.*(cost|credit|balance))/i.test(userText)) {
    picked.add('get_openai_billing_status')
  }
  if (/(cursor|קלוד|claude|גיט|github|גיטהאב|תקלה.*קוד|bug|באג)/i.test(userText)) {
    picked.add('search_agent_tools')
  }
}

export async function selectRelevantToolsForMessage(
  supabase: any,
  userText: string,
  toolDefs: Array<{ name: string; description?: string }>,
  opts: {
    lazy: boolean
    priorityTools: Set<string>
    legacyCoreTools?: Set<string>
    forceInclude: ForceIncludeFn
  },
): Promise<Array<{ name: string; description?: string }>> {
  try {
    if (!userText?.trim() || toolDefs.length <= ROUTER_ACTIVATE_MIN) return toolDefs
    await ensureToolEmbeddings(supabase, toolDefs)
    const matchCount = opts.lazy ? LAZY_ROUTER_MATCH_COUNT : LEGACY_ROUTER_MATCH_COUNT
    const matched = await matchToolNames(supabase, userText, matchCount)
    if (!matched.length) return toolDefs

    const picked = new Set<string>(matched)
    if (opts.lazy) {
      for (const c of LAZY_BOOTSTRAP_TOOLS) picked.add(c)
      for (const c of LAZY_ROUTED_CORE) picked.add(c)
    } else {
      for (const c of opts.legacyCoreTools || []) picked.add(c)
    }
    for (const p of opts.priorityTools) picked.add(p)
    opts.forceInclude(userText, picked)

    const result = toolDefs.filter((t) => picked.has(t.name))
    const minSize = opts.lazy ? 8 : 10
    if (result.length < minSize) return toolDefs
    console.log(`[AGENT] tool router${opts.lazy ? ' (lazy)' : ''}: ${toolDefs.length} → ${result.length} relevant tools`)
    return result
  } catch (e: any) {
    console.error('[AGENT] tool router failed, using full set:', e?.message)
    return toolDefs
  }
}

export async function searchToolsFromIndex(
  supabase: any,
  query: string,
  toolDefs: Array<{ name: string; description?: string }>,
  limit = 12,
): Promise<Array<{ name: string; description?: string }>> {
  const q = String(query || '').trim()
  if (!q) return []
  await ensureToolEmbeddings(supabase, toolDefs)
  const names = await matchToolNames(supabase, q, limit)
  const picked = new Set(names)
  for (const c of LAZY_BOOTSTRAP_TOOLS) picked.add(c)
  return toolDefs.filter((t) => picked.has(t.name))
}

export interface MemoryPointerHit {
  label: string
  text: string
}

/** Semantic pointer recall — replaces bulk 80+50 row scans. */
export async function fetchRelevantMemoryPointers(
  supabase: any,
  tenantIds: string[],
  queryText: string,
  limit = 8,
): Promise<MemoryPointerHit[]> {
  const q = String(queryText || '').trim()
  if (!q || !tenantIds.length) return []
  try {
    const vec = await aiEmbed(q)
    if (!vec) return []
    const primaryTenant = tenantIds[0]
    const { data, error } = await supabase.rpc('kb_match_pointers', {
      p_tenant_id: primaryTenant,
      p_query_embedding: vec,
      p_category: null,
      p_since_days: null,
      p_limit: limit,
    })
    if (error || !data?.length) return []
    return data.map((row: any) => ({
      label: [row.category, row.subcategory].filter(Boolean).join('/') || 'pointer',
      text: [row.title, row.summary].filter(Boolean).join(': '),
    })).filter((item: MemoryPointerHit) => item.text)
  } catch (e: any) {
    console.warn('[AGENT] semantic memory fetch failed:', e?.message)
    return []
  }
}

const MCP_KEYWORD_HINTS: Record<string, RegExp> = {
  cursor: /cursor|קורסור|סוכן\s*פיתוח|cloud\s*agent/i,
  claude: /claude|קלוד/i,
  grok: /grok|גרוק/i,
  manus: /manus|מנוס|מאנוס/i,
  gmail: /gmail|אימייל|מייל|email/i,
  'google-calendar': /יומן|calendar|פגישה|meeting/i,
  'google-drive': /drive|דרייב|קובץ|מסמך/i,
  'meta ads': /פייסבוק|facebook|meta\s*ads|קמפיין/i,
  github: /github|גיטהאב|pr\b|pull\s*request/i,
}

/** Whether an MCP connection's tools should load in lazy mode. */
export function shouldLoadMcpConnection(connName: string, userText: string, forceAll = false): boolean {
  if (forceAll) return true
  const slug = String(connName || '').toLowerCase()
  for (const [key, re] of Object.entries(MCP_KEYWORD_HINTS)) {
    if (slug.includes(key.replace(/\s+/g, '')) || slug.includes(key)) {
      if (re.test(userText)) return true
    }
  }
  for (const [, re] of Object.entries(MCP_KEYWORD_HINTS)) {
    if (re.test(userText)) return true
  }
  return false
}
