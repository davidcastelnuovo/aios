/**
 * Carmen token optimizer — lazy context loading for run-ai-agent.
 *
 * Phase 1: semantic memory, embedding tool router, lazy MCP, search_agent_tools.
 * Phase 2: hybrid BM25+embedding (RRF) routing + two-tier tool schemas
 *          (compact summaries vs full JSON schemas).
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

/** Extra tools unioned after hybrid match in lazy mode. */
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
/** Top hybrid hits get full JSON schemas on round 0; the rest stay compact. */
export const FULL_SCHEMA_TOP_K = 8
export const RRF_K = 60

export type ToolDef = { name: string; description?: string; parameters?: any }

export interface RoutedToolsResult {
  tools: ToolDef[]
  fullSchemaNames: Set<string>
}

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

export async function ensureToolEmbeddings(supabase: any, toolDefs: ToolDef[]): Promise<void> {
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

export function tokenizeForToolSearch(text: string): string[] {
  return String(text || '')
    .toLocaleLowerCase('he')
    .split(/[^\p{L}\p{N}_]+/u)
    .filter((t) => t.length >= 2)
}

/** Lightweight BM25-style keyword rank — fast, no index build per request. */
export function keywordRankToolNames(
  queryText: string,
  toolDefs: ToolDef[],
  limit = 40,
): string[] {
  const terms = tokenizeForToolSearch(queryText)
  if (!terms.length) return []
  const scored = toolDefs
    .map((t) => {
      const name = t.name.toLowerCase()
      const hay = `${name} ${(t.description || '').toLocaleLowerCase('he')}`
      let score = 0
      for (const term of terms) {
        if (name === term || name.includes(term)) score += 4
        else if (hay.includes(term)) score += 1
      }
      return { name: t.name, score }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
  return scored.slice(0, limit).map((x) => x.name)
}

/** Reciprocal Rank Fusion across multiple ranked name lists. */
export function fuseRankedToolNames(rankedLists: string[][]): string[] {
  const scores = new Map<string, number>()
  for (const list of rankedLists) {
    list.forEach((name, idx) => {
      scores.set(name, (scores.get(name) || 0) + 1 / (RRF_K + idx + 1))
    })
  }
  return [...scores.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name)
}

export async function matchToolNamesSemantic(
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

/** Hybrid semantic + keyword router (single LLM round-trip). */
export async function hybridMatchToolNames(
  supabase: any,
  queryText: string,
  toolDefs: ToolDef[],
  matchCount: number,
): Promise<string[]> {
  const pool = Math.max(matchCount * 2, 24)
  const keywordRanked = keywordRankToolNames(queryText, toolDefs, pool)
  await ensureToolEmbeddings(supabase, toolDefs)
  const semanticRanked = await matchToolNamesSemantic(supabase, queryText, pool)
  if (!keywordRanked.length && !semanticRanked.length) return []
  const fused = fuseRankedToolNames([semanticRanked, keywordRanked])
  return fused.slice(0, matchCount)
}

export type ForceIncludeFn = (
  userText: string,
  picked: Set<string>,
  fullSchemaNames?: Set<string>,
) => void

/** Keyword / phrase rules shared by the router and search_agent_tools. */
export function applyToolForceIncludes(userText: string, picked: Set<string>, helpers: {
  isExplicitApprovalPhrase: (t: string) => boolean
  isExplicitRejectionPhrase: (t: string) => boolean
  extractMeetingUrl: (t: string) => string | null
}, fullSchemaNames?: Set<string>): void {
  const promote = (names: string[]) => {
    for (const n of names) {
      picked.add(n)
      fullSchemaNames?.add(n)
    }
  }
  if (/(שכפל|שכפול|וריאצ|קופי|duplicate\s*ad|copy\s*variant|ad\s*variant|inspect.?ad)/i.test(userText)) {
    promote(['inspect_facebook_ad', 'fb_duplicate_ad_variants', 'duplicate_facebook_ad_variants',
      'list_facebook_ads', 'analyze_facebook_campaign', 'execute_pending_approval',
      'reject_pending_approval', 'list_pending_approvals'])
  }
  if (helpers.isExplicitApprovalPhrase(userText) || helpers.isExplicitRejectionPhrase(userText)) {
    promote(['execute_pending_approval', 'reject_pending_approval', 'list_pending_approvals',
      'fb_duplicate_ad_variants', 'duplicate_facebook_ad_variants', 'toggle_facebook_campaign', 'inspect_facebook_ad'])
  }
  if (helpers.extractMeetingUrl(userText)) {
    promote(['join_meeting_for_client', 'get_meeting_bot_status'])
  }
  if (/(שלח.*(וואטסאפ|whatsapp|הודע).*(קמפיינר|איש מכירות|צוות|עובד|אנה)|whatsapp.*(staff|campaigner|sales|team)|שלח.*(לאנה|לקמפיינר|לאיש מכירות)|lookup_staff|send_whatsapp_to_staff)/i.test(userText)) {
    promote(['send_whatsapp_to_staff', 'lookup_staff_whatsapp', 'send_message_to_campaigner',
      'list_campaigners', 'list_sales_people', 'search_entities'])
  }
  if (/\bדופק\b|\bpulse\s*check\b|בדיקת\s*דוח|מצב\s*קמפיינים|סיכום\s*קמפיינים/i.test(userText)) {
    promote(['get_latest_campaign_pulse'])
  }
  if (/(openai|open ai|קרדיט|יתרת|billing|usage|חיוב|כמה.*(נשאר|עולה|הוצא)|api.*(cost|credit|balance))/i.test(userText)) {
    promote(['get_openai_billing_status'])
  }
  if (/(cursor|קלוד|claude|גיט|github|גיטהאב|תקלה.*קוד|bug|באג)/i.test(userText)) {
    promote(['search_agent_tools'])
  }
}

function markFullSchema(
  fullSchemaNames: Set<string>,
  names: Iterable<string>,
): void {
  for (const n of names) fullSchemaNames.add(n)
}

export async function selectRelevantToolsForMessage(
  supabase: any,
  userText: string,
  toolDefs: ToolDef[],
  opts: {
    lazy: boolean
    priorityTools: Set<string>
    legacyCoreTools?: Set<string>
    forceInclude: ForceIncludeFn
  },
): Promise<RoutedToolsResult> {
  const allFull = (tools: ToolDef[]) => ({
    tools,
    fullSchemaNames: new Set(tools.map((t) => t.name)),
  })
  try {
    if (!userText?.trim() || toolDefs.length <= ROUTER_ACTIVATE_MIN) return allFull(toolDefs)
    const matchCount = opts.lazy ? LAZY_ROUTER_MATCH_COUNT : LEGACY_ROUTER_MATCH_COUNT
    const matched = await hybridMatchToolNames(supabase, userText, toolDefs, matchCount)
    if (!matched.length) return allFull(toolDefs)

    const picked = new Set<string>(matched)
    const fullSchemaNames = new Set<string>()
    if (opts.lazy) {
      markFullSchema(fullSchemaNames, LAZY_BOOTSTRAP_TOOLS)
      markFullSchema(fullSchemaNames, LAZY_ROUTED_CORE)
      markFullSchema(fullSchemaNames, matched.slice(0, FULL_SCHEMA_TOP_K))
    } else {
      markFullSchema(fullSchemaNames, opts.legacyCoreTools || [])
      markFullSchema(fullSchemaNames, matched.slice(0, FULL_SCHEMA_TOP_K * 2))
    }
    for (const c of opts.lazy ? LAZY_BOOTSTRAP_TOOLS : []) picked.add(c)
    for (const c of opts.lazy ? LAZY_ROUTED_CORE : []) picked.add(c)
    if (!opts.lazy) {
      for (const c of opts.legacyCoreTools || []) picked.add(c)
    }
    for (const p of opts.priorityTools) {
      picked.add(p)
      fullSchemaNames.add(p)
    }
    opts.forceInclude(userText, picked, fullSchemaNames)

    const result = toolDefs.filter((t) => picked.has(t.name))
    const minSize = opts.lazy ? 8 : 10
    if (result.length < minSize) return allFull(toolDefs)
    if (!opts.lazy) markFullSchema(fullSchemaNames, result.map((t) => t.name))
    console.log(
      `[AGENT] tool router${opts.lazy ? ' (lazy+hybrid)' : ' (hybrid)'}: ${toolDefs.length} → ${result.length} tools, ${fullSchemaNames.size} full schemas`,
    )
    return { tools: result, fullSchemaNames }
  } catch (e: any) {
    console.error('[AGENT] tool router failed, using full set:', e?.message)
    return allFull(toolDefs)
  }
}

/** Compact tool card — name + short blurb, no parameter schema (saves tokens). */
export function compactToolDefinition(tool: ToolDef): ToolDef {
  const desc = String(tool.description || tool.name).replace(/\s+/g, ' ').trim()
  return {
    name: tool.name,
    description: (desc.length > 120 ? `${desc.slice(0, 117)}…` : desc)
      + ' [סכמה מלאה: search_agent_tools או קריאה לכלי]',
    parameters: { type: 'object', properties: {} },
  }
}

export function toolUsesFullSchema(name: string, promoted: Set<string>, compactMode: boolean): boolean {
  if (!compactMode) return true
  return promoted.has(name)
}

export function buildToolApiEntry(
  tool: ToolDef,
  promoted: Set<string>,
  compactMode: boolean,
): { type: 'function'; function: ToolDef } {
  const fn = toolUsesFullSchema(tool.name, promoted, compactMode)
    ? tool
    : compactToolDefinition(tool)
  return { type: 'function', function: fn }
}

export function buildToolApiEntries(
  tools: ToolDef[],
  promoted: Set<string>,
  compactMode: boolean,
): Array<{ type: 'function'; function: ToolDef }> {
  return tools.map((t) => buildToolApiEntry(t, promoted, compactMode))
}

export async function searchToolsFromIndex(
  supabase: any,
  query: string,
  toolDefs: ToolDef[],
  limit = 12,
): Promise<ToolDef[]> {
  const q = String(query || '').trim()
  if (!q) return []
  const names = await hybridMatchToolNames(supabase, q, toolDefs, limit)
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
