// redeploy trigger (restore #5): a Grok-driven session replaced this file — in git AND in prod (v81) — with a
// literal "REPLACE_WITH_FIXED_VERSION" placeholder, so the deployed function had no code at all and every Carmen
// call failed. This restores the last known-good monolithic version (cb03f8b, includes Maskyoo tools from PR #102).
// HARD RULE for any session editing this file: never commit/deploy a placeholder or a "rewrite" that drops the
// ai_agents/command_text contract — the WhatsApp webhooks depend on it. Small, additive diffs only.
// broken rewrite querying a non-existent `agents` table → every agent call 404'd). This is the
// known-good monolithic version from main; CI redeploys it via the Supabase CLI. (re-deploy: a stray placeholder bundle had overwritten v40).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'
import { resolveModelId } from '../_shared/models.ts'
import { assertCallerCanAccessClient, assertCallerCanAccessEntityClient } from '../_shared/auth-helpers.ts'
import { summarizeAndStoreAgentMemory, recallAgentMemory, recallAgentMemoryFTS, saveAgentMemory } from '../_shared/agent-memory.ts'
import { buildCarmenV2SystemPrompt, shouldUseV2Prompt } from '../_shared/carmen-prompt-v2.ts'
import { loadMcpTools } from '../_shared/mcp-tools.ts'
import { spawnSubagent, getSubagentResult, spawnSubagentBatch, getBatchResults } from '../_shared/subagent.ts'
import { resolveActiveSkills, buildSkillsBlockBySlug } from '../_shared/skills/registry.ts'
import { aiEmbed, resolveOpenAIKey } from '../_shared/ai.ts'


const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// ai_memory.user_id is nullable — NULL means system/agent write (no real user).
// The unique index uses COALESCE(user_id, '00000000-0000-0000-0000-000000000000') for dedup.
const SYSTEM_USER_UUID = '00000000-0000-0000-0000-000000000000' // kept for reference only

function resolveModel(engine: string): string {
  return resolveModelId(engine)
}

// ─── Tenant-owned LLM keys ───
// Reads the org's own API keys from the "llm" integration and routes each
// model to its provider's OpenAI-compatible endpoint.
async function resolveLLMTarget(
  supabase: any,
  tenantId: string,
  model: string,
): Promise<{ url: string; key: string; model: string }> {
  const { data } = await supabase
    .from('tenant_integrations')
    .select('settings')
    .eq('tenant_id', tenantId)
    .eq('integration_type', 'llm')
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const s = (data?.settings || {}) as Record<string, string>
  const m = String(model || '')
  const lower = m.toLowerCase()

  if (lower.startsWith('google/') || lower.includes('gemini')) {
    const key = s.google_api_key
    if (!key) throw new Error('Google (Gemini) API key חסר באינטגרציית מודלי AI')
    return {
      url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
      key,
      model: m.replace(/^google\//, ''),
    }
  }
  if (lower.startsWith('anthropic/') || lower.includes('claude')) {
    const key = s.anthropic_api_key
    if (!key) throw new Error('Anthropic (Claude) API key חסר באינטגרציית מודלי AI')
    return { url: 'https://api.anthropic.com/v1/chat/completions', key, model: m.replace(/^anthropic\//, '') }
  }
  // Default: OpenAI (GPT)
  const key = s.openai_api_key
  if (!key) throw new Error('OpenAI (GPT) API key חסר באינטגרציית מודלי AI')
  return { url: 'https://api.openai.com/v1/chat/completions', key, model: m.replace(/^openai\//, '') }
}

// ─── Provider failover chain ───
// When the agent's primary provider is out of quota/credit (Gemini spend cap,
// OpenAI credit gone, Anthropic balance low), Carmen automatically retries the
// SAME request against the next provider that has a configured key — so she keeps
// working instead of failing the whole conversation. Only providers whose key
// exists are included; the agent's own engine is always tried first.
type LLMProvider = 'openai' | 'google' | 'anthropic'
interface LLMTarget { url: string; key: string; model: string; label: string; provider: LLMProvider }
const LLM_FALLBACK_ORDER = ['google/gemini-3-flash-preview', 'openai/gpt-5.4-mini', 'anthropic/claude-sonnet-4-6']

function providerOf(fullId: string): LLMProvider {
  const l = (fullId || '').toLowerCase()
  if (l.startsWith('google/') || l.includes('gemini')) return 'google'
  if (l.startsWith('anthropic/') || l.includes('claude')) return 'anthropic'
  return 'openai'
}

async function buildLLMChain(supabase: any, tenantId: string, primaryFullId: string): Promise<LLMTarget[]> {
  const ordered: string[] = []
  const add = (id: string) => { const full = resolveModelId(id); if (!ordered.includes(full)) ordered.push(full) }
  add(primaryFullId)
  for (const m of LLM_FALLBACK_ORDER) add(m)
  const chain: LLMTarget[] = []
  for (const full of ordered) {
    try {
      const t = await resolveLLMTarget(supabase, tenantId, full) // throws if that provider's key is missing
      chain.push({ ...t, label: full, provider: providerOf(full) })
    } catch { /* provider key not configured → skip it in the chain */ }
  }
  return chain
}

// OpenAI's Chat Completions API hard-caps the tools array at 128 functions per
// request; Google/Anthropic allow far more. When targeting OpenAI with a larger
// toolset, drop low-priority niche tools first, then hard-slice as a last resort,
// so Carmen keeps her full daily toolkit and only sheds rarely-used extras.
const OPENAI_MAX_TOOLS = 128
const LOW_PRIORITY_TOOLS = new Set([
  'send_message_to_manus', 'get_subagent_result', 'get_batch_results', 'delegate_parallel',
  'duplicate_facebook_campaign', 'sync_maskyoo_cdr', 'create_supplier', 'create_product',
  'create_sales_person', 'create_agency', 'prioritize_tasks', 'propose_automation',
  'create_whatsapp_instance', 'get_whatsapp_qr_link', 'connect_google_ads_account', 'save_media_from_chat',
])
function capToolsForTarget(target: LLMTarget, tools: any[]): any[] {
  if (target.provider !== 'openai' || tools.length <= OPENAI_MAX_TOOLS) return tools
  const kept = tools.filter((t) => !LOW_PRIORITY_TOOLS.has(t?.function?.name))
  const capped = kept.length <= OPENAI_MAX_TOOLS ? kept : kept.slice(0, OPENAI_MAX_TOOLS)
  console.log(`[AGENT] OpenAI tool cap: ${tools.length} → ${capped.length}`)
  return capped
}

// Surface an automatic provider switch so David sees it (intel feed + WhatsApp).
// Deduped to once per 30 min so a sustained outage doesn't spam the channel.
async function recordProviderFailover(supabase: any, tenantId: string, fromLabel: string, toLabel: string, reason: string) {
  try {
    const since = new Date(Date.now() - 30 * 60 * 1000).toISOString()
    const { data: recent } = await supabase.from('integration_alerts_log')
      .select('id').eq('alert_type', 'provider_failover').gte('fired_at', since).limit(1)
    if (recent?.length) return
    await supabase.from('integration_alerts_log').insert({
      tenant_id: tenantId, provider: providerOf(toLabel), alert_type: 'provider_failover',
      reason: `כרמן עברה אוטומטית מ-${fromLabel} ל-${toLabel} (${reason})`,
    })
    await supabase.rpc('claude_notify_david', {
      p_message: `♻️ כרמן המשיכה לעבוד ללא הפרעה: הספק ${fromLabel} נגמר/נחסם ועברתי אוטומטית ל-${toLabel}. כדאי לטעון קרדיט לספק המקורי.`,
    }).then(() => {}, () => {})
  } catch { /* reporting must never break the reply */ }
}

// Rough per-model pricing (USD per 1M tokens in/out) for the usage panel.
// Unknown models log tokens with a null cost rather than a wrong one.
function estimateLLMCostUSD(model: string, tokensIn: number, tokensOut: number): number | null {
  if (!tokensIn && !tokensOut) return null
  const m = (model || '').toLowerCase()
  const price: [number, number] | null =
    m.includes('gpt-4o-mini') ? [0.15, 0.6]
    : m.includes('gpt-4o') ? [2.5, 10]
    : m.includes('gpt-4.1-mini') ? [0.4, 1.6]
    : m.includes('gpt-4.1') ? [2, 8]
    : m.includes('haiku') ? [0.8, 4]
    : m.includes('sonnet') ? [3, 15]
    : m.includes('gemini') ? [0.1, 0.4]
    : null
  if (!price) return null
  return +((tokensIn * price[0] + tokensOut * price[1]) / 1e6).toFixed(6)
}

// Resolve a usable Google Calendar access token for the tenant: caller's user →
// explicit user → any campaigner with tokens → tenant owner/admin. Refreshes if
// expired. Returns { accessToken } or { error } (Hebrew, user-facing).
async function resolveCalendarAccessToken(supabase: any, tenantId: string, callerCampaignerId: string | null, userId: string | null): Promise<{ accessToken?: string; error?: string }> {
  let calTokenUserId: string | null = null
  if (callerCampaignerId) {
    const { data: prof } = await supabase.from('profiles').select('id').eq('campaigner_id', callerCampaignerId).maybeSingle()
    if (prof?.id) calTokenUserId = prof.id
  }
  if (!calTokenUserId && userId && userId !== 'system') calTokenUserId = userId
  if (!calTokenUserId) {
    const { data: tenantCampaigners } = await supabase.from('campaigners').select('id').eq('tenant_id', tenantId).limit(20)
    for (const c of (tenantCampaigners || [])) {
      const { data: prof } = await supabase.from('profiles').select('id').eq('campaigner_id', c.id).maybeSingle()
      if (!prof?.id) continue
      const { data: tok } = await supabase.from('calendar_tokens').select('user_id').eq('user_id', prof.id).maybeSingle()
      if (tok?.user_id) { calTokenUserId = tok.user_id; break }
    }
  }
  if (!calTokenUserId) {
    // Owners (e.g. a second-tenant owner) are tenant_users without a campaigner row.
    const { data: owners } = await supabase.from('tenant_users')
      .select('user_id').eq('tenant_id', tenantId).in('role', ['owner', 'admin']).limit(10)
    for (const o of (owners || [])) {
      const { data: tok } = await supabase.from('calendar_tokens').select('user_id').eq('user_id', o.user_id).maybeSingle()
      if (tok?.user_id) { calTokenUserId = o.user_id; break }
    }
  }
  if (!calTokenUserId) return { error: 'לא נמצא חיבור Google Calendar פעיל בטננט. חבר יומן תחת הגדרות אינטגרציות.' }

  const { data: tokenData } = await supabase.from('calendar_tokens').select('access_token, refresh_token, expires_at').eq('user_id', calTokenUserId).maybeSingle()
  if (!tokenData) return { error: 'לא נמצא חיבור Google Calendar. חבר יומן תחת הגדרות אינטגרציות.' }
  let accessToken: string = tokenData.access_token
  if (new Date(tokenData.expires_at) <= new Date()) {
    const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')
    if (!clientId || !clientSecret) return { error: 'חסרות הגדרות GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET' }
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: tokenData.refresh_token, grant_type: 'refresh_token' }),
    })
    const rd = await r.json()
    if (!rd.access_token) return { error: `רענון טוקן נכשל: ${rd.error || 'unknown'}` }
    accessToken = rd.access_token
    await supabase.from('calendar_tokens').update({ access_token: accessToken, expires_at: new Date(Date.now() + rd.expires_in * 1000).toISOString() }).eq('user_id', calTokenUserId)
  }
  return { accessToken }
}

// ===========================
// ALL AVAILABLE TOOLS
// ===========================
const ALL_TOOLS = [
  // LEADS
  { name: 'create_lead', description: 'יצירת ליד חדש', parameters: { type: 'object', properties: { company_name: { type: 'string' }, contact_name: { type: 'string' }, phone: { type: 'string' }, email: { type: 'string' }, source: { type: 'string' }, notes: { type: 'string' } }, required: ['contact_name'] } },
  { name: 'list_leads', description: 'רשימת לידים', parameters: { type: 'object', properties: { status: { type: 'string' }, limit: { type: 'integer' } } } },
  { name: 'update_lead_status', description: 'עדכון סטטוס ליד', parameters: { type: 'object', properties: { lead_id: { type: 'string' }, status: { type: 'string' } }, required: ['lead_id', 'status'] } },
  { name: 'add_lead_update', description: 'הוספת עדכון לליד', parameters: { type: 'object', properties: { lead_id: { type: 'string' }, content: { type: 'string' } }, required: ['lead_id', 'content'] } },
  // TASKS (team tasks - for campaigners/team members)
  { name: 'create_task', description: 'יצירת משימה לצוות (קמפיינרים/אנשי צוות). השתמש בכלי הזה רק כשרוצים ליצור משימה לאדם אחר בצוות. אם המשימה היא לכרמן עצמה — השתמש ב-create_agent_task במקום!', parameters: { type: 'object', properties: { title: { type: 'string' }, client_id: { type: 'string' }, lead_id: { type: 'string' }, campaigner_id: { type: 'string', description: 'מזהה קמפיינר לשיוך המשימה' }, priority: { type: 'integer' }, due_date: { type: 'string' }, due_time: { type: 'string' }, notes: { type: 'string' }, duration_minutes: { type: 'integer', description: 'משך המשימה בדקות' } }, required: ['title'] } },
  // AGENT TASKS (for Carmen herself)
  { name: 'create_agent_task', description: 'יצירת משימה לכרמן עצמה (ניהול משימות סוכנים). השתמש בכלי הזה כשהמשתמש מבקש מכרמן ליצור משימה לעצמה, משימה חוזרת, או תזכורת. המשימה תופיע בלוח "ניהול משימות סוכנים". חשוב: scheduled_at חייב להיות בפורמט ISO UTC (Z). אם המשתמש נקב בשעה — היא בשעון ישראל (Asia/Jerusalem); המירי ל-UTC לפני השמירה.', parameters: { type: 'object', properties: { title: { type: 'string', description: 'כותרת המשימה' }, description: { type: 'string', description: 'תיאור מפורט של המשימה' }, priority: { type: 'integer', description: 'עדיפות 1-10 (ברירת מחדל 5)' }, schedule_type: { type: 'string', enum: ['once', 'daily', 'weekly'], description: 'סוג תזמון' }, scheduled_at: { type: 'string', description: 'תאריך ושעה לביצוע ב-ISO UTC (לדוגמה 2026-06-20T18:30:00Z עבור 21:30 שעון ישראל)' }, cron_expression: { type: 'string', description: 'ביטוי CRON למשימות חוזרות' }, task_skills: { type: 'array', items: { type: 'string' }, description: 'רשימת סקילים להפעלה' } }, required: ['title'] } },
  { name: 'list_my_agent_tasks', description: 'רשימת המשימות המתוזמנות של כרמן עצמה (agent_tasks). השתמשי בכלי הזה כשהמשתמש שואל "מה תזמנת?", "באיזו שעה התזכורת?", "תבדקי אם הגדרת" — אסור לענות על שאלות כאלה מהזיכרון בלי לקרוא לכלי הזה. מחזיר זמני תזמון בשעון ישראל.', parameters: { type: 'object', properties: { status: { type: 'string', enum: ['pending','running','completed','failed'], description: 'סינון לפי סטטוס (אופציונלי)' }, limit: { type: 'integer', description: 'ברירת מחדל 10' } } } },
  { name: 'recall_recent_action', description: 'בדיקה אם כרמן כבר ביצעה פעולה כבדה לאחרונה (pulse_check, campaign_analysis, lead_review וכד׳). חובה לקרוא לכלי הזה לפני הרצה של pulse_check / סקירת קמפיינים / סקירת לידים — כדי לא לעבוד פעמיים. מחזיר את הסיכום של הריצה האחרונה אם נמצאה בחלון הזמן. אם נמצא תוצאה: ענה על הסיכום הקיים וציין את הזמן (בשעון ישראל), ושאל את המשתמש אם לרענן.', parameters: { type: 'object', properties: { action_type: { type: 'string', description: 'שם הפעולה — לדוגמה pulse_check, campaign_analysis, lead_review' }, max_age_hours: { type: 'integer', description: 'גיל מקסימלי של הריצה הקודמת בשעות (ברירת מחדל 8)' } }, required: ['action_type'] } },
  { name: 'record_action_episode', description: 'שמירת תוצאה של פעולה כבדה ב-long-term memory של כרמן (carmen_memory_episodes). חובה לקרוא בסיום של pulse_check / סקירת קמפיינים / סקירת לידים — כדי שבפעם הבאה recall_recent_action ימצא את התוצאה. כתוב summary תמציתי של מה שמצאת.', parameters: { type: 'object', properties: { action_type: { type: 'string', description: 'pulse_check / campaign_analysis / lead_review וכד׳' }, summary: { type: 'string', description: 'סיכום תמציתי של מה שמצאת — מספר לקוחות, דגלים, אזהרות, החלטות' }, topic_tags: { type: 'array', items: { type: 'string' }, description: 'תגיות נוספות (לקוחות מעורבים, סוכנויות וכו׳)' }, importance: { type: 'integer', description: '1-100 (ברירת מחדל 50)' } }, required: ['action_type', 'summary'] } },
  { name: 'search_tasks', description: 'חיפוש משימות לפי שם/כותרת. חשוב! השתמש בכלי הזה לפני יצירת משימה כדי לוודא שהיא לא קיימת כבר', parameters: { type: 'object', properties: { search_term: { type: 'string', description: 'מילת חיפוש בכותרת המשימה' }, status: { type: 'string' }, client_id: { type: 'string' } }, required: ['search_term'] } },
  { name: 'list_tasks', description: 'רשימת משימות', parameters: { type: 'object', properties: { status: { type: 'string' }, client_id: { type: 'string' }, limit: { type: 'integer' } } } },
  { name: 'update_task_status', description: 'עדכון סטטוס משימה', parameters: { type: 'object', properties: { task_id: { type: 'string' }, status: { type: 'string', enum: ['open', 'in_progress', 'completed', 'cancelled'] } }, required: ['task_id', 'status'] } },
  // CLIENTS
  { name: 'list_clients', description: 'רשימת/חיפוש לקוחות. אפשר לסנן לפי סטטוס, קמפיינר, סוכנות (agency_id/agency_name — חובה לסנן כשהמשתמש שואל על "לקוחות בסוכנות X"), או name_search. הערה: כשהקורא הוא קמפיינר (WhatsApp), ברירת המחדל היא הצגת לקוחות שמשוייכים אליו בלבד בסטטוס active/onboarding — אלא אם סופק campaigner_name/agency_name אחר במפורש. החיפוש case-insensitive. אל תאמר "לא נמצא" לפני שניסית name_search.', parameters: { type: 'object', properties: { status: { type: 'string', description: 'active / onboarding / inactive. ברירת מחדל עבור קמפיינר WhatsApp: active+onboarding בלבד.' }, limit: { type: 'integer' }, name_search: { type: 'string', description: 'חיפוש חלקי בשם הלקוח או איש הקשר (case-insensitive). נסה גם תעתיק אנגלי לעברית ולהפך.' }, campaigner_id: { type: 'string', description: 'סינון ללקוחות המשוייכים לקמפיינר זה (דרך client_team)' }, campaigner_name: { type: 'string', description: 'סינון לפי שם קמפיינר (חיפוש חופשי בשם המלא)' }, agency_id: { type: 'string', description: 'סינון ללקוחות בסוכנות זו בלבד' }, agency_name: { type: 'string', description: 'סינון לפי שם סוכנות (חיפוש חלקי, case-insensitive). חובה להשתמש כשהמשתמש מציין סוכנות בשם.' }, all_scopes: { type: 'boolean', description: 'דרוס את הסקופ האוטומטי של הקמפיינר והחזר את כל הלקוחות בארגון (לשימוש רק אם המשתמש ביקש זאת מפורשות).' } } } },
  { name: 'get_client_info', description: 'מידע על לקוח', parameters: { type: 'object', properties: { client_id: { type: 'string' } }, required: ['client_id'] } },
  { name: 'add_client_update', description: 'הוספת עדכון ללקוח', parameters: { type: 'object', properties: { client_id: { type: 'string' }, content: { type: 'string' } }, required: ['client_id', 'content'] } },
  // MESSAGES
  { name: 'send_message', description: 'שליחת הודעת WhatsApp ללקוח או ליד', parameters: { type: 'object', properties: { contact_type: { type: 'string', enum: ['lead', 'client'] }, contact_id: { type: 'string' }, message_text: { type: 'string' } }, required: ['contact_type', 'contact_id', 'message_text'] } },
  // SEARCH
  { name: 'search_entities', description: 'חיפוש סוכנויות, לקוחות, קמפיינרים או לידים לפי שם. עבור client: אם הקורא הוא קמפיינר WhatsApp, התוצאות מוגבלות אוטומטית ללקוחות שלו אלא אם הועבר all_scopes=true. ניתן לסנן clients/leads לפי agency_id.', parameters: { type: 'object', properties: { entity_type: { type: 'string', enum: ['agency', 'client', 'campaigner', 'lead'] }, search_term: { type: 'string' }, agency_id: { type: 'string', description: 'הגבלה לסוכנות מסוימת (רלוונטי ל-client/lead)' }, all_scopes: { type: 'boolean', description: 'דרוס את סקופ הקמפיינר והחזר תוצאות מכל הארגון.' } }, required: ['entity_type', 'search_term'] } },
  { name: 'query_system_graph', description: 'חיפוש לקריאה בלבד בגרף הארכיטקטורה של AIOS: קוד, Edge Functions, טבלאות SQL, מודולים וקשרים ביניהם. השתמשי רק לשאלות טכניות על מבנה המערכת, מיקום מימוש, תלות בין רכיבים או השפעת שינוי. הכלי זמין למנהלים בלבד ואינו מחזיר נתוני לקוחות.', parameters: { type: 'object', properties: { query: { type: 'string', description: 'מונחים טכניים לחיפוש, רצוי באנגלית ושמות רכיבים מדויקים' }, depth: { type: 'integer', minimum: 0, maximum: 3, description: 'עומק ניווט בקשרים, ברירת מחדל 2' }, limit: { type: 'integer', minimum: 1, maximum: 80, description: 'מספר צמתים מרבי, ברירת מחדל 40' } }, required: ['query'] } },
  // MANUS AI - Complex task delegation
  { name: 'delegate_to_manus', description: 'שליחת משימה מורכבת ל-Manus AI לביצוע ברקע (מחקר שוק, ניתוח קמפיינים, יצירת תוכן, ניתוח נתונים). המשימה רצה ברקע ועשויה לקחת דקות עד שעות.', parameters: { type: 'object', properties: { prompt: { type: 'string', description: 'תיאור מפורט של המשימה לביצוע' }, context_data: { type: 'string', description: 'נתוני הקשר רלוונטיים (למשל נתוני קמפיינים)' } }, required: ['prompt'] } },
  { name: 'send_message_to_manus', description: 'שליחת הודעה ישירה ל-Manus agent פעיל (תקשורת ישירה). משמש לשאלות, עדכונים, או המשך שיחה עם Manus על משימה קיימת. מחזיר מיידית ללא המתנה לתשובה.', parameters: { type: 'object', properties: { message: { type: 'string', description: 'ההודעה לשליחה ל-Manus' }, task_id: { type: 'string', description: 'מזהה המשימה הקיימת (אופציונלי — אם לא מוגדר ישתמש ב-agent-default)' } }, required: ['message'] } },
  { name: 'get_facebook_campaign_data', description: 'שליפת נתוני קמפיינים מפייסבוק לצורך ניתוח', parameters: { type: 'object', properties: { client_id: { type: 'string' }, days: { type: 'integer', description: 'מספר ימים אחורה (ברירת מחדל 30)' } } } },
  { name: 'list_facebook_campaigns', description: 'רשימת קמפיינים פעילים/מושבתים של לקוח עם campaign_id, שם וסטטוס. השתמש כדי למצוא את ה-campaign_id לפני toggle.', parameters: { type: 'object', properties: { client_id: { type: 'string' }, name_search: { type: 'string', description: 'חיפוש חלקי בשם הקמפיין' } }, required: ['client_id'] } },
  { name: 'toggle_facebook_campaign', description: 'הפעלה (ACTIVE) או השהיה (PAUSED) של קמפיין פייסבוק לפי campaign_id. דורש אישור מפורש של המשתמש לפני הפעלה — אל תקרא לכלי לפני שהמשתמש אישר את הפעולה הספציפית.', parameters: { type: 'object', properties: { client_id: { type: 'string', description: 'מזהה הלקוח שהקמפיין שייך אליו' }, campaign_id: { type: 'string', description: 'Facebook campaign ID (מספרי, לא שם)' }, status: { type: 'string', enum: ['ACTIVE', 'PAUSED'] }, confirmed: { type: 'boolean', description: 'חובה true — מאשר שהמשתמש אישר במפורש את הפעולה' } }, required: ['client_id', 'campaign_id', 'status', 'confirmed'] } },
  { name: 'analyze_facebook_campaign', description: 'ניתוח עומק של קמפיין פייסבוק יחיד: השוואת היום מול 7 ימים מול 30 ימים, מטריקות (CPL, CTR, frequency, spend), זיהוי חריגות והמלצות לפעולה. השתמש לפני שמציעים פעולה כדי לבסס המלצה.', parameters: { type: 'object', properties: { client_id: { type: 'string', description: 'מזהה הלקוח שהקמפיין שייך אליו' }, campaign_id: { type: 'string' } }, required: ['client_id', 'campaign_id'] } },
  { name: 'update_facebook_budget', description: 'עדכון תקציב יומי או כולל לקמפיין פייסבוק. דורש אישור מפורש של המשתמש (confirmed=true). חריגה של מעל 20% או מעל 500 ש"ח דורשת התרעה מפורשת.', parameters: { type: 'object', properties: { client_id: { type: 'string', description: 'מזהה הלקוח שהקמפיין שייך אליו' }, campaign_id: { type: 'string' }, daily_budget: { type: 'number', description: 'תקציב יומי בשקלים (לא במיקרו-יחידות)' }, lifetime_budget: { type: 'number' }, confirmed: { type: 'boolean' } }, required: ['client_id', 'campaign_id', 'confirmed'] } },
  { name: 'duplicate_facebook_campaign', description: 'שכפול קמפיין פייסבוק (במצב PAUSED) לצורך ניסיון בקהל/יצירה אחרים. דורש אישור.', parameters: { type: 'object', properties: { client_id: { type: 'string', description: 'מזהה הלקוח שהקמפיין שייך אליו' }, campaign_id: { type: 'string' }, name_suffix: { type: 'string' }, confirmed: { type: 'boolean' } }, required: ['client_id', 'campaign_id', 'confirmed'] } },
  { name: 'get_campaign_alerts', description: 'שליפת התראות פתוחות על קמפיינים (קמפיין נעצר, מודעה לא מאושרת, CPL חורג, frequency גבוה). השתמש בתחילת בדיקת דופק או כשהמשתמש שואל על מצב הקמפיינים.', parameters: { type: 'object', properties: { client_id: { type: 'string' }, severity: { type: 'string', enum: ['info', 'warning', 'critical'] }, only_open: { type: 'boolean', description: 'ברירת מחדל true' } } } },
  { name: 'acknowledge_campaign_alert', description: 'סימון התראת קמפיין כטופלה.', parameters: { type: 'object', properties: { alert_id: { type: 'string' } }, required: ['alert_id'] } },
  { name: 'list_social_pages', description: 'רשימת עמודים מחוברים (פייסבוק/אינסטגרם) של הטננט. שימושי לפני פרסום או טיפול בתגובות.', parameters: { type: 'object', properties: { platform: { type: 'string', enum: ['facebook', 'instagram'] }, client_id: { type: 'string' } } } },
  { name: 'publish_social_post', description: 'פרסום פוסט/תמונה/וידאו/Reel/Story לעמוד פייסבוק או אינסטגרם. דורש page_id (UUID של social_pages, לא ה-FB page id), post_type ו-caption/media_url. דורש confirmed=true.', parameters: { type: 'object', properties: { page_id: { type: 'string' }, post_type: { type: 'string', enum: ['post', 'photo', 'video', 'reel', 'story', 'link'] }, caption: { type: 'string' }, media_url: { type: 'string', description: 'URL ציבורי של המדיה (חובה ל-photo/video/reel/story)' }, link: { type: 'string' }, confirmed: { type: 'boolean' } }, required: ['page_id', 'post_type', 'confirmed'] } },
  { name: 'fetch_social_comments', description: 'משיכת תגובות חדשות מעמוד פייסבוק/אינסטגרם ועדכון מסד הנתונים.', parameters: { type: 'object', properties: { page_id: { type: 'string' } }, required: ['page_id'] } },
  { name: 'list_social_comments', description: 'רשימת תגובות שלא נענו, לפי לקוח/עמוד.', parameters: { type: 'object', properties: { page_id: { type: 'string' }, client_id: { type: 'string' }, only_unreplied: { type: 'boolean' } } } },
  { name: 'reply_to_social_comment', description: 'מענה לתגובה בעמוד פייסבוק/אינסטגרם. דורש comment_row_id (UUID מ-social_comments) ו-message. דורש confirmed=true.', parameters: { type: 'object', properties: { comment_row_id: { type: 'string' }, message: { type: 'string' }, confirmed: { type: 'boolean' } }, required: ['comment_row_id', 'message', 'confirmed'] } },
  { name: 'hide_social_comment', description: 'הסתרת תגובה (FB בלבד). דורש confirmed=true.', parameters: { type: 'object', properties: { comment_row_id: { type: 'string' }, confirmed: { type: 'boolean' } }, required: ['comment_row_id', 'confirmed'] } },
  { name: 'sync_social_pages', description: 'סנכרון מחדש של כל העמודים (כולל Page Access Tokens) מפייסבוק. הרץ אחרי חיבור חדש או כשעמוד חסר.', parameters: { type: 'object', properties: { client_id: { type: 'string' } } } },
  { name: 'analyze_campaign_performance', description: 'ניתוח ביצועי קמפיינים מטבלאות CRM. מזהה טבלאות קמפיין לפי שדות (spend+campaign_name) ולא לפי שם — תופס גם טבלאות בעברית. מחזיר coverage_summary (כמה לקוחות מסונכרנים מתוך הסקופ), synced_clients (עם spend/CPL/שינוי 7 מול 30 יום) ו-not_connected_clients (לקוחות שאין להם טבלת קמפיין). חובה לדווח על שני הסלוטים, ולא רק על מי שיש לו נתונים.', parameters: { type: 'object', properties: { client_id: { type: 'string', description: 'מזהה לקוח ספציפי' }, agency_id: { type: 'string', description: 'סינון לסוכנות מסוימת' }, agency_name: { type: 'string', description: 'סינון לפי שם סוכנות (case-insensitive, חיפוש חלקי)' } } } },
  { name: 'get_latest_campaign_pulse', description: 'שליפת תמונת הדופק האחרונה שכבר חושבה ונשמרה, ללא קריאת API חיצונית וללא חישוב מחדש. זה הכלי הראשון לשאלות על מצב לקוח/סוכנות/קמפיינים. מחזיר freshness ומקור; רק אם המשתמש מבקש נתונים חיים או ניתוח עמוק יש לעבור ל-analyze_campaign_performance.', parameters: { type: 'object', properties: { client_id: { type: 'string' }, client_name: { type: 'string', description: 'חיפוש חלקי בשם הלקוח' }, agency_id: { type: 'string' }, agency_name: { type: 'string', description: 'חיפוש חלקי בשם הסוכנות' }, status: { type: 'string', enum: ['healthy', 'warning', 'critical', 'no_data'] } } } },
  // MASKYOO CALLS REPORTING
  { name: 'get_maskyoo_calls_report', description: 'דוח שיחות מסקיו לדוחות SEO. מחזיר ספירות שיחות נכנסות לפי לקוח וקטגוריה (organic/paid) מ-seo_call_snapshots. אם אין snapshot — שולף ישירות מ-call_logs. מחזיר השוואה בין תקופות אם period_compare=true.', parameters: { type: 'object', properties: { client_id: { type: 'string', description: 'מזהה לקוח (אופציונלי — בלעדיו מחזיר כל הלקוחות)' }, client_name: { type: 'string', description: 'חיפוש לקוח לפי שם אם אין client_id' }, period_start: { type: 'string', description: 'תחילת תקופה YYYY-MM-DD (ברירת מחדל: תחילת החודש הנוכחי)' }, period_end: { type: 'string', description: 'סוף תקופה YYYY-MM-DD (ברירת מחדל: היום)' }, category: { type: 'string', enum: ['organic', 'paid', 'all'], description: 'ברירת מחדל: all' }, period_compare: { type: 'boolean', description: 'אם true — מחזיר גם תקופה קודמת מקבילה להשוואה' } } } },
  { name: 'sync_maskyoo_cdr', description: 'סנכרון CDRs (Call Detail Records) מ-API של מסקיו אל call_logs. הרץ כשהנתונים לא עדכניים. מחזיר כמה רשומות נוספו.', parameters: { type: 'object', properties: { from_date: { type: 'string', description: 'YYYY-MM-DD — תאריך התחלה לסנכרון (ברירת מחדל 7 ימים אחורה)' } } } },
  { name: 'update_client_health', description: 'עדכון מצב בריאות לקוח: מעדכן mood_status בטבלת clients ויוצר רשומה ב-communication_logs. השתמש בכלי הזה כדי להדליק דגל על לקוח כשמזהים בעיה (התייקרות, ירידה בביצועים).', parameters: { type: 'object', properties: { client_id: { type: 'string' }, mood_status: { type: 'string', enum: ['happy', 'wavering', 'churn_risk'], description: 'מצב הלקוח: happy=תקין, wavering=מתלבט, churn_risk=סיכון נטישה' }, communication_status: { type: 'string', enum: ['normal', 'sensitive', 'complaint'], description: 'סטטוס תקשורת לרשומת communication_logs' }, note: { type: 'string', description: 'הערה/סיכום — מה הבעיה שזוהתה' } }, required: ['client_id', 'mood_status', 'note'] } },
  // CLIENTS - full CRUD
  { name: 'create_client', description: 'יצירת לקוח חדש במערכת', parameters: { type: 'object', properties: { name: { type: 'string', description: 'שם העסק/לקוח' }, contact_name: { type: 'string' }, phone: { type: 'string' }, email: { type: 'string' }, agency_id: { type: 'string', description: 'מזהה סוכנות (אופציונלי)' }, notes: { type: 'string' } }, required: ['name'] } },
  { name: 'update_client', description: 'עדכון פרטי לקוח קיים', parameters: { type: 'object', properties: { client_id: { type: 'string' }, name: { type: 'string' }, contact_name: { type: 'string' }, phone: { type: 'string' }, email: { type: 'string' }, status: { type: 'string', enum: ['active', 'inactive', 'lead'] }, notes: { type: 'string' } }, required: ['client_id'] } },
  { name: 'update_client_status', description: 'עדכון סטטוס לקוח', parameters: { type: 'object', properties: { client_id: { type: 'string' }, status: { type: 'string', enum: ['active', 'inactive', 'lead'] } }, required: ['client_id', 'status'] } },
  { name: 'set_campaign_table_active', description: 'סימון טבלת קמפיין כפעילה/כבויה (crm_tables.campaign_active). השתמשי כשאומרים לך שקמפיין של לקוח הופסק או חזר לפעול — בדיקות דופק ובדיקות חיבורים מדווחות רק על טבלאות שמסומנות פעילות. זיהוי לפי client_id (כל טבלאות הקמפיינים של הלקוח), table_id מדויק, או table_name (חיפוש חלקי).', parameters: { type: 'object', properties: { client_id: { type: 'string' }, table_id: { type: 'string' }, table_name: { type: 'string', description: 'שם או slug של הטבלה (חיפוש חלקי)' }, active: { type: 'boolean', description: 'true=הקמפיין פעיל ומדווחים עליו, false=כבוי ולא מדווחים' } }, required: ['active'] } },
  // LEADS - full CRUD
  { name: 'update_lead', description: 'עדכון פרטי ליד קיים (שם, טלפון, אימייל, מקור, הערות)', parameters: { type: 'object', properties: { lead_id: { type: 'string' }, company_name: { type: 'string' }, contact_name: { type: 'string' }, phone: { type: 'string' }, email: { type: 'string' }, source: { type: 'string' }, notes: { type: 'string' }, follow_up_date: { type: 'string', description: 'תאריך מעקב בפורמט YYYY-MM-DD' } }, required: ['lead_id'] } },
  { name: 'delete_lead', description: 'מחיקת ליד מהמערכת', parameters: { type: 'object', properties: { lead_id: { type: 'string' } }, required: ['lead_id'] } },
  // TASKS - full CRUD
  { name: 'update_task', description: 'עדכון פרטי משימה (כותרת, תאריך, עדיפות, הערות, סטטוס, שיוך ליד/קמפיינר)', parameters: { type: 'object', properties: { task_id: { type: 'string' }, title: { type: 'string' }, due_date: { type: 'string' }, due_time: { type: 'string' }, priority: { type: 'integer', description: '1-10' }, notes: { type: 'string' }, client_id: { type: 'string' }, lead_id: { type: 'string' }, campaigner_id: { type: 'string' }, duration_minutes: { type: 'integer' }, status: { type: 'string', enum: ['open', 'in_progress', 'completed', 'cancelled'] } }, required: ['task_id'] } },
  { name: 'delete_task', description: 'מחיקת משימה', parameters: { type: 'object', properties: { task_id: { type: 'string' } }, required: ['task_id'] } },
  { name: 'add_task_update', description: 'הוספת הערה/עדכון למשימה', parameters: { type: 'object', properties: { task_id: { type: 'string' }, content: { type: 'string' } }, required: ['task_id', 'content'] } },
  { name: 'manage_task_collaborators', description: 'הוספה או הסרה של שותפים (קמפיינרים) למשימה', parameters: { type: 'object', properties: { task_id: { type: 'string' }, campaigner_id: { type: 'string' }, action: { type: 'string', enum: ['add', 'remove'] } }, required: ['task_id', 'campaigner_id', 'action'] } },
  // CLIENT ONBOARDING
  { name: 'create_onboarding', description: 'יצירת תהליך קליטת לקוח חדש', parameters: { type: 'object', properties: { title: { type: 'string' }, client_id: { type: 'string' }, campaigner_id: { type: 'string' }, notes: { type: 'string' } }, required: ['title', 'client_id'] } },
  { name: 'list_onboarding', description: 'רשימת תהליכי קליטת לקוחות', parameters: { type: 'object', properties: { status: { type: 'string' }, limit: { type: 'integer' } } } },
  { name: 'update_onboarding_status', description: 'עדכון סטטוס קליטת לקוח', parameters: { type: 'object', properties: { onboarding_id: { type: 'string' }, status: { type: 'string', enum: ['pending', 'in_progress', 'completed', 'cancelled'] } }, required: ['onboarding_id', 'status'] } },
  // CAMPAIGNERS
  { name: 'list_campaigners', description: 'רשימת קמפיינרים בטננט', parameters: { type: 'object', properties: { limit: { type: 'integer' } } } },
  { name: 'create_campaigner', description: 'יצירת קמפיינר חדש', parameters: { type: 'object', properties: { full_name: { type: 'string' }, phone: { type: 'string' }, email: { type: 'string' }, role: { type: 'array', items: { type: 'string' } } }, required: ['full_name'] } },
  // SALES PEOPLE
  { name: 'list_sales_people', description: 'רשימת אנשי מכירות', parameters: { type: 'object', properties: { limit: { type: 'integer' } } } },
  { name: 'create_sales_person', description: 'יצירת איש מכירות חדש', parameters: { type: 'object', properties: { full_name: { type: 'string' }, phone: { type: 'string' }, email: { type: 'string' } }, required: ['full_name'] } },
  // AGENCIES
  { name: 'list_agencies', description: 'רשימת סוכנויות בטננט', parameters: { type: 'object', properties: { limit: { type: 'integer' } } } },
  { name: 'create_agency', description: 'יצירת סוכנות חדשה', parameters: { type: 'object', properties: { name: { type: 'string' }, contact_name: { type: 'string' }, phone: { type: 'string' }, email: { type: 'string' } }, required: ['name'] } },
  // SUPPLIERS
  { name: 'list_suppliers', description: 'רשימת ספקים', parameters: { type: 'object', properties: { limit: { type: 'integer' } } } },
  { name: 'create_supplier', description: 'יצירת ספק חדש', parameters: { type: 'object', properties: { name: { type: 'string' }, type: { type: 'string' }, phone: { type: 'string' }, email: { type: 'string' } }, required: ['name'] } },
  // PRODUCTS
  { name: 'list_products', description: 'רשימת מוצרים/שירותים', parameters: { type: 'object', properties: { limit: { type: 'integer' } } } },
  { name: 'create_product', description: 'יצירת מוצר/שירות חדש', parameters: { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' }, price: { type: 'number' } }, required: ['name', 'price'] } },
  // AUTOMATIONS
  { name: 'list_automations', description: 'רשימת אוטומציות', parameters: { type: 'object', properties: { limit: { type: 'integer' } } } },
  { name: 'toggle_automation', description: 'הפעלה/כיבוי אוטומציה', parameters: { type: 'object', properties: { automation_id: { type: 'string' }, active: { type: 'boolean' } }, required: ['automation_id', 'active'] } },
  // REPORTS & ANALYTICS
  { name: 'get_dashboard_stats', description: 'שליפת נתוני דשבורד: כמה לידים, לקוחות, משימות פתוחות, ועוד', parameters: { type: 'object', properties: {} } },
  // SOCIAL MEDIA
  { name: 'create_social_post', description: 'יצירת פוסט/מודעה חדשה במודול ניהול סושיאל מדיה. השתמש בכלי הזה כדי ליצור פוסטים עם תוכן טקסטואלי ותמונות. הפוסט יישמר כטיוטה במערכת.', parameters: { type: 'object', properties: { title: { type: 'string', description: 'כותרת הפוסט/מודעה' }, content: { type: 'string', description: 'תוכן הפוסט - הקופי של המודעה' }, post_type: { type: 'string', enum: ['text', 'image', 'video', 'carousel'], description: 'סוג הפוסט' }, media_urls: { type: 'array', items: { type: 'string' }, description: 'קישורי מדיה (תמונות/וידאו)' } }, required: ['title', 'content'] } },
  { name: 'generate_ad_image', description: 'יצירת תמונה למודעה/פוסט באמצעות AI. מחזיר URL של התמונה שנוצרה. השתמש בכלי הזה כדי ליצור ויזואל למודעות ופוסטים ואז השתמש ב-create_social_post כדי לשמור את הפוסט.', parameters: { type: 'object', properties: { prompt: { type: 'string', description: 'תיאור מפורט של התמונה הרצויה באנגלית' }, aspect_ratio: { type: 'string', enum: ['1:1', '16:9', '9:16', '4:5'], description: 'יחס גובה-רוחב' } }, required: ['prompt'] } },
  // MEMORY
  { name: 'save_memory', description: 'שמירת מידע לזיכרון מתמשך (העדפות, פרויקטים, הוראות)', parameters: { type: 'object', properties: { key: { type: 'string', description: 'מפתח זיהוי' }, content: { type: 'string', description: 'התוכן לשמירה' }, category: { type: 'string', enum: ['preferences', 'projects', 'clients', 'workflows', 'personal', 'instructions'] } }, required: ['key', 'content'] } },
  { name: 'recall_memory', description: 'שליפת זיכרונות שנשמרו (key/value, מהיר)', parameters: { type: 'object', properties: { category: { type: 'string' }, search: { type: 'string' } } } },
  { name: 'recall_memory_fts', description: 'חיפוש זיכרונות חוצה-שיחות עם Full-Text Search ודירוג לפי importance. השתמשי כדי למצוא הקשר רלוונטי משיחות עבר על נושא, לקוח, או הוראה. שונה מ-recall_memory: זה מחפש בכל ה-agent_memory (זיכרונות שנוצרו אוטומטית מסיכומי ריצות + זיכרונות ידניים) ומדורג לפי חשיבות.', parameters: { type: 'object', properties: { query: { type: 'string', description: 'טקסט חיפוש (מילות מפתח, שם לקוח, נושא)' }, limit: { type: 'integer', description: 'ברירת מחדל 5' }, min_importance: { type: 'integer', description: 'סף חשיבות מינימלי 0-100' } }, required: ['query'] } },
  { name: 'delete_memory', description: 'מחיקת זיכרון', parameters: { type: 'object', properties: { key: { type: 'string' } }, required: ['key'] } },
  // KNOWLEDGE BASE (Carmen Memory Pointers + Episodes — ממלכת הידע)
  { name: 'kb_list_folder', description: 'דפדוף בממלכת הידע של כרמן. מחזיר מצביעים (pointers) בתיקייה: clients/, team/, messages/<date>/, conversations/<topic>/, system_map/. הציון `path` הוא ההיררכיה. השתמש כדי לראות מה קיים לפני kb_open.', parameters: { type: 'object', properties: { category: { type: 'string', enum: ['clients','team','messages','conversations','system_map'] }, subcategory: { type: 'string' }, path_prefix: { type: 'string', description: 'תחילית נתיב לסינון, למשל "clients/" או "team/<id>/tasks"' }, limit: { type: 'integer' } } } },
  { name: 'kb_search', description: 'חיפוש סמנטי+טקסטואלי בממלכת הידע. מחזיר pointers רלוונטיים לפי דמיון embedding ל-query, מסונן אופציונלית לקטגוריה/תאריך. השתמש כשמחפשים מידע על נושא, לקוח, או אירוע ולא יודעים את הנתיב המדויק.', parameters: { type: 'object', properties: { query: { type: 'string' }, category: { type: 'string' }, since_days: { type: 'integer', description: 'הגבל לרשומות עם ref_date מ-N הימים האחרונים' }, limit: { type: 'integer' } }, required: ['query'] } },
  { name: 'kb_open', description: 'פתיחת pointer וקבלת הנתון החי מה-DB (clients/campaigners/tasks/chat_messages/seo_reports וכו׳ — תמיד הנתון העדכני, לא העתק). השתמש אחרי kb_list_folder/kb_search.', parameters: { type: 'object', properties: { pointer_id: { type: 'string' } }, required: ['pointer_id'] } },
  { name: 'kb_recall_conversation', description: 'שליפת סיכומי שיחות עבר (episodes) לפי נושא או חיפוש סמנטי. מחזיר summary + source_ids להפניה להודעות המקוריות.', parameters: { type: 'object', properties: { query: { type: 'string' }, topic: { type: 'string' }, since_days: { type: 'integer' }, limit: { type: 'integer' } } } },
  { name: 'kb_learn', description: 'שמירת ידע פרוצדורלי/אפיזודי חדש (לקח שנלמד, נוהל, סיכום שיחה חשובה). שונה מ-save_memory: זה נכנס לממלכת הידע עם embedding לחיפוש סמנטי. שמור פה דברים שכרמן צריכה לזכור לטווח ארוך עם הקשר.', parameters: { type: 'object', properties: { topic: { type: 'string' }, summary: { type: 'string' }, topic_tags: { type: 'array', items: { type: 'string' } }, importance: { type: 'integer', description: '1-10' }, source_table: { type: 'string' }, source_ids: { type: 'array', items: { type: 'string' } } }, required: ['topic','summary'] } },
  // CHAT HISTORY
  { name: 'get_chat_history', description: 'שליפת היסטוריית שיחות WhatsApp עם ליד או לקוח', parameters: { type: 'object', properties: { contact_type: { type: 'string', enum: ['lead', 'client'] }, contact_id: { type: 'string' }, limit: { type: 'integer' } }, required: ['contact_type', 'contact_id'] } },
  { name: 'search_conversation_history', description: 'שליפה מכל היסטוריית ההתכתבויות של הארגון (WhatsApp) — ללא מגבלת סשן. שני מצבים: (1) חיפוש מילות מפתח — "מה המייל של פליקס", שם לקוח, נושא. חשוב: חפשי מילות תוכן בלבד (שם/מייל/נושא) — לעולם לא מילות זמן כמו "אתמול"/"בערב", הן לא מופיעות בהודעות! (2) דפדוף לפי זמן — לשאלות "מה דיברנו אתמול/בשבוע שעבר": קראי בלי query עם days_back מתאים ו-only_carmen_chats=true, ותקבלי את השיחות איתך כרונולוגית. אם חיפוש לא מצא — נסי מילה אחרת או עברי לדפדוף לפני שאת אומרת שאין.', parameters: { type: 'object', properties: { query: { type: 'string', description: 'מילות תוכן לחיפוש (עד 4, כולן חייבות להופיע). השמיטי לדפדוף לפי זמן.' }, days_back: { type: 'integer', description: 'כמה ימים אחורה (ברירת מחדל 180; לדפדוף "אתמול" השתמשי ב-2)' }, only_carmen_chats: { type: 'boolean', description: 'רק שיחות בערוץ של כרמן (ברירת מחדל true בדפדוף בלי query)' }, with_phone: { type: 'string', description: 'סינון לשיחות עם מספר טלפון מסוים' }, limit: { type: 'integer', description: 'מקסימום תוצאות (ברירת מחדל 20, בדפדוף 40)' } } } },
  { name: 'get_recent_inbound_messages', description: 'שליפת הודעות נכנסות אחרונות מכל השיחות', parameters: { type: 'object', properties: { limit: { type: 'integer' }, hours: { type: 'integer', description: 'כמה שעות אחורה (ברירת מחדל 24)' } } } },
  // FINANCE
  { name: 'list_finance', description: 'רשימת תנועות כספיות', parameters: { type: 'object', properties: { client_id: { type: 'string' }, type: { type: 'string', enum: ['income', 'expense'] }, limit: { type: 'integer' } } } },
  { name: 'create_finance_entry', description: 'יצירת רשומה כספית', parameters: { type: 'object', properties: { client_id: { type: 'string' }, amount: { type: 'number' }, type: { type: 'string', enum: ['income', 'expense'] }, description: { type: 'string' }, date: { type: 'string' } }, required: ['amount', 'type', 'description'] } },
  { name: 'get_finance_summary', description: 'סיכום כספי חודשי', parameters: { type: 'object', properties: { month: { type: 'string', description: 'YYYY-MM' } } } },
  // UPDATES
  { name: 'list_updates', description: 'רשימת עדכונים ללקוח או ליד', parameters: { type: 'object', properties: { entity_type: { type: 'string', enum: ['client', 'lead'] }, entity_id: { type: 'string' }, limit: { type: 'integer' } }, required: ['entity_type', 'entity_id'] } },
  // GOALS
  { name: 'create_goal', description: 'יצירת יעד חדש במערכת היעדים ההיררכית', parameters: { type: 'object', properties: { title: { type: 'string' }, description: { type: 'string' }, parent_goal_id: { type: 'string', description: 'מזהה יעד-אב (אופציונלי)' }, due_date: { type: 'string' }, owner_type: { type: 'string', enum: ['agent', 'campaigner'] }, owner_id: { type: 'string' } }, required: ['title'] } },
  { name: 'list_goals', description: 'רשימת יעדים עם אחוז התקדמות', parameters: { type: 'object', properties: { status: { type: 'string' }, limit: { type: 'integer' } } } },
  // AGENT TASK OWNERSHIP
  { name: 'take_task', description: 'כרמן לוקחת בעלות על משימה - מעדכנת assigned_agent וסטטוס ל-agent_working', parameters: { type: 'object', properties: { task_id: { type: 'string' }, agent_name: { type: 'string', description: 'שם הסוכן שלוקח את המשימה (ברירת מחדל: כרמן)' } }, required: ['task_id'] } },
  { name: 'complete_task_step', description: 'כרמן מדווחת על השלמת שלב במשימה ומוסיפה עדכון מסוג agent_action', parameters: { type: 'object', properties: { task_id: { type: 'string' }, step_description: { type: 'string' }, mark_complete: { type: 'boolean', description: 'האם לסמן את המשימה כהושלמה' } }, required: ['task_id', 'step_description'] } },
  { name: 'prioritize_tasks', description: 'ניתוח משימות פתוחות והצעת סדר עדיפויות לפי דדליינים, יעדים ועומס', parameters: { type: 'object', properties: { limit: { type: 'integer' } } } },
  // FACEBOOK AD ACCOUNTS
  { name: 'list_facebook_ad_accounts', description: 'שליפת כל חשבונות המודעות מפייסבוק. מחזיר id, name, status, currency.', parameters: { type: 'object', properties: {} } },
  { name: 'create_facebook_report_table', description: 'חיבור חשבון מודעות פייסבוק ללקוח — יוצר טבלת דוח facebook_insights ב-CRM', parameters: { type: 'object', properties: { client_id: { type: 'string', description: 'מזהה הלקוח' }, ad_account_id: { type: 'string', description: 'מזהה חשבון מודעות פייסבוק (act_XXXXX)' }, ad_account_name: { type: 'string', description: 'שם חשבון המודעות' } }, required: ['client_id', 'ad_account_id', 'ad_account_name'] } },
  { name: 'list_unconnected_clients', description: 'רשימת לקוחות פעילים שאין להם עדיין טבלת דוח פייסבוק (facebook_insights) ב-CRM. שימושי לזיהוי לקוחות שצריכים חיבור.', parameters: { type: 'object', properties: {} } },
  { name: 'check_ad_accounts_health', description: 'בדיקת תקינות חשבונות מודעות פייסבוק לכל הלקוחות בסקופ הקורא. מחזיר לכל לקוח: status (active/disabled/closed), has_spend_7d (האם יש הוצאה ב-7 ימים אחרונים), all_paused (האם כל הקמפיינים מושהים), token_ok (האם הטוקן תקף), flags (מערך של בעיות). השתמשי ב-pulse check ובכל בקשת "תקינות/מצב חשבונות מודעות".', parameters: { type: 'object', properties: { client_id: { type: 'string' }, agency_id: { type: 'string' } } } },
  // INTEGRATIONS MANAGEMENT
  { name: 'list_integrations', description: 'רשימת אינטגרציות מוגדרות בטננט (סוג, סטטוס פעיל, הגדרות בסיסיות). שימושי כשרוצים לדעת מה מחובר ומה לא.', parameters: { type: 'object', properties: { type: { type: 'string', description: 'סינון לפי סוג אינטגרציה' }, only_active: { type: 'boolean' } } } },
  { name: 'toggle_integration', description: 'הפעלה או השבתה של אינטגרציה לפי מזהה.', parameters: { type: 'object', properties: { integration_id: { type: 'string' }, is_active: { type: 'boolean' } }, required: ['integration_id', 'is_active'] } },
  // AGENT MANAGEMENT (Carmen building & managing sub-agents)
  { name: 'list_agents', description: 'רשימת סוכני AI בטננט (כולל סוכנים תחתיים של כרמן).', parameters: { type: 'object', properties: { only_active: { type: 'boolean' } } } },
  { name: 'create_agent', description: 'יצירת סוכן AI חדש תחת כרמן. השתמש כשהמשתמש מבקש לבנות סוכן חדש לתפקיד ספציפי.', parameters: { type: 'object', properties: { name: { type: 'string' }, talent: { type: 'string', description: 'תיאור התפקיד והמומחיות' }, personality: { type: 'string' }, soul: { type: 'string', description: 'מטרה/ייעוד' }, engine: { type: 'string', description: 'מודל (gemini-3-flash וכו׳)' } }, required: ['name', 'talent'] } },
  { name: 'update_agent', description: 'עדכון פרטי סוכן קיים.', parameters: { type: 'object', properties: { agent_id: { type: 'string' }, name: { type: 'string' }, talent: { type: 'string' }, personality: { type: 'string' }, soul: { type: 'string' }, engine: { type: 'string' }, active: { type: 'boolean' } }, required: ['agent_id'] } },
  // GITHUB AGENT DELEGATION (system self-repair)

  // WHATSAPP GATEWAY MANAGEMENT (Manus Gateway)
  { name: 'create_whatsapp_instance', description: 'יצירת instance חדש של WhatsApp ב-Gateway עבור לקוח. מחזיר integrationId ו-instanceId. לאחר יצירה, השתמש ב-get_whatsapp_qr_link כדי לקבל קישור סריקה.', parameters: { type: 'object', properties: { displayName: { type: 'string', description: 'שם תצוגה לחיבור (לדוגמה: "יוסי - עסק")' }, countryCode: { type: 'string', description: 'קידומת מדינה (ברירת מחדל: 972 לישראל)' } }, required: ['displayName'] } },
  { name: 'get_whatsapp_qr_link', description: 'קבלת קישור ציבורי לסריקת QR לחיבור WhatsApp. שלח את הקישור ללקוח. הקישור תקף ל-2 שעות.', parameters: { type: 'object', properties: { integrationId: { type: 'string', description: 'מזהה האינטגרציה (מ-create_whatsapp_instance או מ-list_integrations)' } }, required: ['integrationId'] } },
  { name: 'get_whatsapp_status', description: 'בדיקת סטטוס חיבור WhatsApp של instance. מחזיר CONNECTED/DISCONNECTED/QR_READY ומספר הטלפון אם מחובר.', parameters: { type: 'object', properties: { integrationId: { type: 'string', description: 'מזהה האינטגרציה' } }, required: ['integrationId'] } },
  { name: 'send_whatsapp_via_gateway', description: 'שליחת הודעת WhatsApp דרך instance ספציפי של ה-Gateway. עדיף על send_message כשרוצים לשלוח מחיבור מסוים.', parameters: { type: 'object', properties: { integrationId: { type: 'string', description: 'מזהה האינטגרציה' }, phone: { type: 'string', description: 'מספר טלפון (עם או בלי קידומת)' }, message: { type: 'string', description: 'תוכן ההודעה' } }, required: ['integrationId', 'phone', 'message'] } },
  { name: 'delegate_to_github_agent', description: 'האצלת בעיה טכנית/באג במערכת לסוכן הגיטהאב לאבחון או תיקון. השתמש כשמדווחים על תקלה במערכת או באג בקוד.', parameters: { type: 'object', properties: { message: { type: 'string', description: 'תיאור הבעיה/הבקשה הטכנית' }, action: { type: 'string', enum: ['chat_support', 'analyze_error', 'fix_code', 'check_permissions'], description: 'ברירת מחדל: chat_support' } }, required: ['message'] } },
  // ===========================
  // HERMES SKILLS SYSTEM (self-improving procedural memory)
  // ===========================
  { name: 'recall_skills', description: 'חיפוש סקילים (פרוצדורות שמורות) רלוונטיים למשימה הנוכחית. השתמש כשהמשימה מורכבת/חוזרת ויתכן שכבר יש לך פרוצדורה שמורה לבצע אותה. הסקילים הרלוונטיים ביותר כבר מוזרקים אוטומטית, אבל ניתן לחפש עוד.', parameters: { type: 'object', properties: { query: { type: 'string', description: 'תיאור המשימה לחיפוש' }, limit: { type: 'integer', description: 'ברירת מחדל 5' } }, required: ['query'] } },
  { name: 'create_skill', description: 'יצירת סקיל חדש (פרוצדורה שמורה) אחרי שביצעת משימה מורכבת בהצלחה ויש סיכוי שתבצע אותה שוב. כתוב את ה-body כשלבים ברורים בעברית, מצב מילות טריגר רלוונטיות שיעזרו למצוא את הסקיל בעתיד. אל תיצור סקיל למשימות פשוטות/חד-פעמיות.', parameters: { type: 'object', properties: { name: { type: 'string', description: 'שם קצר וברור (למשל "ניתוח קמפיין שבועי")' }, description: { type: 'string', description: 'משפט אחד שמתאר מתי להשתמש בסקיל הזה' }, body: { type: 'string', description: 'תוכן הסקיל - שלבים מסודרים, באיזה כלים להשתמש, מה לבדוק' }, trigger_phrases: { type: 'array', items: { type: 'string' }, description: 'מילים/ביטויים בעברית או באנגלית שיעזרו למצוא את הסקיל' } }, required: ['name', 'description', 'body'] } },
  { name: 'update_skill', description: 'עדכון/שיפור סקיל קיים על בסיס ניסיון חדש. השתמש כשגילית שצעד מסוים לא עובד טוב או שיש דרך טובה יותר לבצע את המשימה.', parameters: { type: 'object', properties: { skill_id: { type: 'string' }, body: { type: 'string', description: 'תוכן מעודכן' }, description: { type: 'string', description: 'תיאור מעודכן (אופציונלי)' }, change_note: { type: 'string', description: 'הערה קצרה מה השתנה ולמה' } }, required: ['skill_id', 'body'] } },
  // ===========================
  // SUBAGENT DELEGATION (Phase 4) — spawn focused background sub-tasks
  // ===========================
  { name: 'delegate_to_subagent', description: 'יצירת תת-סוכן (subagent) שירוץ ברקע על משימה ממוקדת — מחקר, ניתוח רב-לקוחות, סריקה ארוכה, או כל עבודה שלא חייבת להיענות בשיחה הנוכחית. מחזיר sub_task_id מיידית. השתמשי בכלי הזה במקום delegate_to_manus כשהמשימה היא פנימית למערכת (מצריכה כלים של כרמן עצמה). אסור להשתמש בו לתשובה קצרה שאפשר לענות מיד — רק כשהמשימה תיקח זמן או צריכה לרוץ ברקע במקביל לשיחה.', parameters: { type: 'object', properties: { title: { type: 'string', description: 'כותרת קצרה לתת-המשימה' }, prompt: { type: 'string', description: 'הוראה מפורטת מה לבצע. כתבי כאילו את מדריכה כרמן אחרת — כללי המטרה, היקף, ומה חייב להחזיר בסוף.' }, task_mode: { type: 'string', enum: ['analyst','sales','support','copywriting','scheduler','onboarding'], description: 'מוד פעולה (אופציונלי)' }, task_skills: { type: 'array', items: { type: 'string' }, description: 'סקילים להפעיל בתת-הסוכן' }, priority: { type: 'integer', description: '1-10' } }, required: ['title','prompt'] } },
  { name: 'get_subagent_result', description: 'בדיקת מצב/קבלת תוצאה של תת-סוכן שנוצר ב-delegate_to_subagent. מחזיר status, done, ואם הסתיים — output. אל תקראי לזה בלולאה צמודה; אם done=false פשוט המשיכי בעבודה אחרת או הודיעי למשתמש שהמשימה עדיין רצה.', parameters: { type: 'object', properties: { sub_task_id: { type: 'string', description: 'המזהה שהוחזר מ-delegate_to_subagent' } }, required: ['sub_task_id'] } },
  { name: 'delegate_parallel', description: 'מולטיטאסק: פיזור כמה תת-משימות עצמאיות לרקע (עד 8). משימות קריאה/ניתוח/מחקר (side_effects=false) רצות במקביל; משימות שמשנות משהו/שולחות החוצה (side_effects=true, ברירת מחדל) נכנסות לתור סדרתי ורצות אחת-בכל-רגע — לעולם לא שתיים מסוכנות יחד. סמני side_effects נכון לכל תת-משימה. כל תת-משימה עצמאית ולא חופפת. מחזיר batch_id; אספי עם get_batch_results וסנתזי. אל תשתמשי בזה למשימה אחת — לזה יש delegate_to_subagent.', parameters: { type: 'object', properties: { tasks: { type: 'array', description: 'מערך תת-משימות עצמאיות', items: { type: 'object', properties: { title: { type: 'string' }, prompt: { type: 'string', description: 'הוראה עצמאית מלאה — מטרה, היקף, פורמט פלט, ובמפורש "אל תחפפי עם תת-משימות אחרות".' }, task_skills: { type: 'array', items: { type: 'string' }, description: 'סקינז לכפות על תת-משימה זו (למשל ["campaigner"])' }, side_effects: { type: 'boolean', description: 'true = משנה/שולח (תור סדרתי) · false = קריאה/ניתוח בלבד (מקבילי). ברירת מחדל true.' } }, required: ['title','prompt'] } } }, required: ['tasks'] } },
  { name: 'get_batch_results', description: 'איסוף תוצאות של batch שנוצר ב-delegate_parallel. מחזיר לכל תת-משימה status/output (גם אם חלקן נכשלו — בידוד כשל חלקי), וכן total/completed/failed/running ו-all_done. כשהכל הושלם — סנתזי את התוצאות לתשובה אחת.', parameters: { type: 'object', properties: { batch_id: { type: 'string', description: 'ה-batch_id שהוחזר מ-delegate_parallel' } }, required: ['batch_id'] } },
  { name: 'propose_automation', description: 'הצעת אוטומציה חדשה לבנייה — כרמן מתכננת פלואו (טריגר + שלבים) ושולחת לאישור המשתמש. האוטומציה תיווצר כבויה רק לאחר אישור, אז בטוח להציע. השתמשי בזה כשהמשתמש מבקש "תבני/תחברי לי אוטומציה". כל שלב agent יכול לכפות סקין (campaigner/seo/...). מחזיר approval_id; הסבירי למשתמש מה תכננת ובקשי אישור.', parameters: { type: 'object', properties: {
    name: { type: 'string', description: 'שם האוטומציה' },
    description: { type: 'string' },
    trigger_type: { type: 'string', description: 'סוג טריגר, למשל scheduled_daily / lead_created / whatsapp_message_received' },
    trigger_config: { type: 'object', description: 'הגדרת הטריגר, למשל {"hour":8,"minute":0} ל-scheduled_daily' },
    steps: { type: 'array', description: 'שלבי הפלואו בסדר לינארי', items: { type: 'object', properties: {
      type: { type: 'string', enum: ['agent','action','condition','delay','merge'], description: 'סוג השלב' },
      skin: { type: 'string', description: 'לשלב agent — סקין לכפות (slug)' },
      instruction: { type: 'string', description: 'לשלב agent — ההוראה לשלב' },
      action_type: { type: 'string', description: 'לשלב action — למשל notification / send_greenapi_message / create_task' },
      config: { type: 'object', description: 'הגדרת השלב' },
      label: { type: 'string' },
    }, required: ['type'] } },
  }, required: ['name','trigger_type','steps'] } },
  // ===========================
  // MEDIA LIBRARY (carmen-media bucket + marketing_media_library)
  // ===========================
  { name: 'save_media_from_chat', description: 'שמירת מדיה (תמונה/וידאו) מהודעת צ\'אט אל ספריית המדיה של הלקוח. אם message_id ניתן — מושך את כתובת הקובץ מההודעה אוטומטית. אם רק media_url — שומר ישירות. אסור להמציא URL — או לקבל מהמשתמש או להשתמש ב-message_id מההיסטוריה.', parameters: { type: 'object', properties: { message_id: { type: 'string', description: 'מזהה ההודעה ב-chat_messages (עדיף)' }, media_url: { type: 'string' }, mime_type: { type: 'string' }, client_id: { type: 'string' }, lead_id: { type: 'string' }, caption: { type: 'string' }, tags: { type: 'array', items: { type: 'string' } } } } },
  { name: 'list_client_media', description: 'רשימת קבצי מדיה ששמורים ללקוח (או ליד). מחזיר media_id, mime, ad_ready, caption.', parameters: { type: 'object', properties: { client_id: { type: 'string' }, lead_id: { type: 'string' }, only_ad_ready: { type: 'boolean' }, tags: { type: 'array', items: { type: 'string' } }, limit: { type: 'integer' } } } },
  // ===========================
  // META (Facebook + Instagram) ADS — all mutating actions go through approval queue
  // ===========================
  { name: 'fb_create_campaign', description: 'יצירת קמפיין חדש בפייסבוק/אינסטגרם. **דורש אישור בוואטסאפ** — הכלי יוצר בקשת אישור ומחכה. סטטוס ברירת מחדל PAUSED. השתמש objective: OUTCOME_LEADS / OUTCOME_TRAFFIC / OUTCOME_SALES.', parameters: { type: 'object', properties: { client_id: { type: 'string' }, name: { type: 'string' }, objective: { type: 'string' }, daily_budget: { type: 'number', description: 'בש"ח (לא מינור-יוניטס)' }, special_ad_categories: { type: 'array', items: { type: 'string' } } }, required: ['client_id','name'] } },
  { name: 'fb_create_adset', description: 'יצירת ad set חדש (קהל יעד + תקציב). דורש אישור.', parameters: { type: 'object', properties: { campaign_id: { type: 'string' }, name: { type: 'string' }, daily_budget: { type: 'number' }, billing_event: { type: 'string' }, optimization_goal: { type: 'string' }, targeting: { type: 'object', description: 'מבנה Meta targeting (geo, age, interests)' }, start_time: { type: 'string' }, end_time: { type: 'string' } }, required: ['campaign_id','name','targeting'] } },
  { name: 'fb_create_creative_from_media', description: 'בניית קריאייטיב חדש מתוך media_id בספריה + page_id + טקסט. דורש אישור. אם lead_form_id מצורף — הקריאייטיב יוצר/מקושר ל-Lead Gen Form.', parameters: { type: 'object', properties: { client_id: { type: 'string' }, media_id: { type: 'string' }, page_id: { type: 'string' }, message: { type: 'string' }, link: { type: 'string' }, name: { type: 'string' }, call_to_action_type: { type: 'string' }, lead_form_id: { type: 'string' } }, required: ['client_id','media_id','page_id','message'] } },
  { name: 'fb_create_ad', description: 'יצירת מודעה (ad) ב-ad set קיים עם קריאייטיב מוכן. דורש אישור.', parameters: { type: 'object', properties: { adset_id: { type: 'string' }, name: { type: 'string' }, creative_id: { type: 'string' } }, required: ['adset_id','name','creative_id'] } },
  { name: 'fb_replace_lead_form', description: 'החלפת טופס לידים במודעה קיימת. דורש אישור.', parameters: { type: 'object', properties: { ad_id: { type: 'string' }, new_form_id: { type: 'string' } }, required: ['ad_id','new_form_id'] } },
  { name: 'fb_update_budget', description: 'שינוי תקציב יומי או lifetime לקמפיין/ad set. דורש אישור.', parameters: { type: 'object', properties: { entity_id: { type: 'string', description: 'campaign_id או adset_id' }, daily_budget: { type: 'number' }, lifetime_budget: { type: 'number' } }, required: ['entity_id'] } },
  { name: 'fb_pause', description: 'השהיית קמפיין/ad set/מודעה (PAUSED). דורש אישור.', parameters: { type: 'object', properties: { entity_id: { type: 'string' } }, required: ['entity_id'] } },
  { name: 'fb_resume', description: 'הדלקה מחדש (ACTIVE) של קמפיין/ad set/מודעה. דורש אישור.', parameters: { type: 'object', properties: { entity_id: { type: 'string' } }, required: ['entity_id'] } },
  // ===========================
  // GOOGLE ADS — pause/resume/budget at campaign level
  // ===========================
  { name: 'gads_pause', description: 'השהיית קמפיין Google Ads. דורש אישור.', parameters: { type: 'object', properties: { customer_id: { type: 'string' }, campaign_id: { type: 'string' } }, required: ['customer_id','campaign_id'] } },
  { name: 'gads_resume', description: 'הדלקת קמפיין Google Ads. דורש אישור.', parameters: { type: 'object', properties: { customer_id: { type: 'string' }, campaign_id: { type: 'string' } }, required: ['customer_id','campaign_id'] } },
  { name: 'gads_update_budget', description: 'שינוי תקציב יומי לקמפיין Google Ads. דורש אישור.', parameters: { type: 'object', properties: { customer_id: { type: 'string' }, campaign_id: { type: 'string' }, daily_budget: { type: 'number' } }, required: ['customer_id','campaign_id','daily_budget'] } },
  { name: 'list_google_ad_accounts', description: 'שליפת כל חשבונות Google Ads המחוברים לטננט. מחזיר customer_id, name, status, client_id (אם משויך ללקוח).', parameters: { type: 'object', properties: { client_id: { type: 'string', description: 'סינון לפי לקוח ספציפי (אופציונלי)' } } } },
  { name: 'connect_google_ads_account', description: 'שיוך חשבון Google Ads (customer_id) ללקוח ב-CRM. שומר את המזהה ב-clients.google_ads_account_id.', parameters: { type: 'object', properties: { client_id: { type: 'string', description: 'מזהה הלקוח' }, customer_id: { type: 'string', description: 'מזהה חשבון Google Ads (ספרות בלבד, ללא מקפים)' } }, required: ['client_id', 'customer_id'] } },
  // ===========================
  // SCHEDULED PAUSE/RESUME
  // ===========================
  { name: 'schedule_campaign_toggle', description: 'תזמון אוטומטי של כיבוי/הדלקה בלוח זמנים (cron) או חד-פעמי (run_at). דורש אישור. דוגמה: לכבות כל יום ב-22:00 → cron_expression "0 22 * * *". להדליק ראשון-חמישי 07:00 → "0 7 * * 1-5".', parameters: { type: 'object', properties: { entity_id: { type: 'string' }, entity_type: { type: 'string', enum: ['fb_campaign','fb_adset','fb_ad','google_campaign'] }, action: { type: 'string', enum: ['pause','resume'] }, cron_expression: { type: 'string' }, run_at: { type: 'string', description: 'ISO datetime לחד-פעמי' }, timezone: { type: 'string', description: 'ברירת מחדל Asia/Jerusalem' }, client_id: { type: 'string' }, notes: { type: 'string' } }, required: ['entity_id','entity_type','action'] } },
  { name: 'list_campaign_schedules', description: 'רשימת תזמונים פעילים של פעולות על קמפיינים (כיבוי/הדלקה).', parameters: { type: 'object', properties: { client_id: { type: 'string' }, only_enabled: { type: 'boolean' }, limit: { type: 'integer' } } } },
  { name: 'cancel_campaign_schedule', description: 'ביטול תזמון קיים.', parameters: { type: 'object', properties: { schedule_id: { type: 'string' } }, required: ['schedule_id'] } },
  // ===========================
  // BROADCAST (דיוור)
  // ===========================
  { name: 'list_broadcasts', description: 'רשימת דיוורים קיימים (broadcasts). מחזיר שם, ערוץ, סטטוס, תאריך תזמון וסטטיסטיקות שליחה. השתמש כדי לראות מה קיים לפני יצירה חדשה.', parameters: { type: 'object', properties: { status: { type: 'string', enum: ['draft','scheduled','sending','sent','paused','failed','canceled'], description: 'סינון לפי סטטוס (אופציונלי)' }, limit: { type: 'integer', description: 'ברירת מחדל 20' } } } },
  { name: 'create_broadcast', description: 'יצירת דיוור WhatsApp חדש לקהל יעד (לקוחות / לידים / קמפיינרים / רשימה / קבוצות וואטסאפ). דורש אישור לפני שליחה. אחרי יצירה — שאל "לשלוח עכשיו או לתזמן?".', parameters: { type: 'object', properties: { name: { type: 'string', description: 'שם הדיוור' }, body_text: { type: 'string', description: 'תוכן ההודעה. אפשר להשתמש ב-{{contact_name}} כמשתנה.' }, audience_source: { type: 'string', enum: ['clients','leads','campaigners','wa_groups'], description: 'מקור הקהל' }, audience_filter: { type: 'object', description: 'פרמטרים נוספים לפי source: clients→{statuses,tagIds}, leads→{statusKeys,salesPersonIds}, campaigners→{roles}, wa_groups→{groupIds:["uuid1",...]}' }, scheduled_at: { type: 'string', description: 'תאריך ושעה לתזמון ב-ISO UTC (אופציונלי — ריק = שלח מיד אחרי אישור)' }, integration_id: { type: 'string', description: 'UUID של חיבור WhatsApp לשימוש (אופציונלי — ישתמש בברירת מחדל)' } }, required: ['name', 'body_text', 'audience_source'] } },
  { name: 'send_broadcast_now', description: 'שליחה מיידית של דיוור קיים (status=draft/scheduled). דורש אישור. מעביר לסטטוס sending ומתחיל לשלוח.', parameters: { type: 'object', properties: { broadcast_id: { type: 'string', description: 'מזהה הדיוור' } }, required: ['broadcast_id'] } },
  { name: 'schedule_broadcast', description: 'תזמון דיוור קיים לשליחה בזמן עתידי. דורש אישור. מעביר לסטטוס scheduled.', parameters: { type: 'object', properties: { broadcast_id: { type: 'string', description: 'מזהה הדיוור' }, scheduled_at: { type: 'string', description: 'תאריך ושעה ב-ISO UTC (לדוגמה 2026-07-01T18:00:00Z עבור 21:00 שעון ישראל)' } }, required: ['broadcast_id', 'scheduled_at'] } },
  { name: 'cancel_broadcast', description: 'ביטול דיוור מתוזמן או עצירת דיוור פעיל. דורש אישור.', parameters: { type: 'object', properties: { broadcast_id: { type: 'string' } }, required: ['broadcast_id'] } },
  { name: 'list_wa_groups', description: 'רשימת קבוצות וואטסאפ הזמינות לדיוור (לא חסומות). מחזיר id, group_name, group_chat_id. השתמש כדי לקבל groupIds לפני יצירת דיוור לקבוצות.', parameters: { type: 'object', properties: { name_search: { type: 'string', description: 'חיפוש חלקי בשם הקבוצה (אופציונלי)' }, limit: { type: 'integer', description: 'ברירת מחדל 50' } } } },
  // ===========================
  // APPROVAL FLOW
  // ===========================
  { name: 'list_pending_approvals', description: 'רשימת בקשות אישור פתוחות (פעולות שכרמן ביקשה לבצע ומחכות לאישור משתמש). השתמש כשהמשתמש שולח "אשרי"/"כן" כדי למצוא איזו בקשה לבצע.', parameters: { type: 'object', properties: { limit: { type: 'integer' } } } },
  { name: 'execute_pending_approval', description: 'ביצוע בקשת אישור פתוחה — אחרי שהמשתמש אישר בוואטסאפ ("אשרי"/"כן"). הכלי מבצע את הפעולה בפועל ומעדכן את הסטטוס. אם אין approval_id — קח את הפתוח האחרון מ-list_pending_approvals.', parameters: { type: 'object', properties: { approval_id: { type: 'string' } } } },
  { name: 'reject_pending_approval', description: 'דחיית בקשת אישור פתוחה — אחרי שהמשתמש סירב.', parameters: { type: 'object', properties: { approval_id: { type: 'string' }, reason: { type: 'string' } }, required: ['approval_id'] } },
  // ===========================
  // CALENDAR INVITES
  // ===========================
  { name: 'send_calendar_invite', description: 'שליחת זימון Google Calendar (ICS) דרך מייל לנמען חיצוני — האירוע נוצר ביומן הארגון עם הנמען כמשתתף, וגוגל שולחת לו מייל אוטומטי עם כפתורי אישור/דחייה. השתמש כשהמשתמש רוצה לזמן פגישה עם אדם חיצוני.', parameters: { type: 'object', properties: { attendee_email: { type: 'string', description: 'כתובת המייל של המוזמן' }, attendee_name: { type: 'string', description: 'שם המוזמן (אופציונלי)' }, title: { type: 'string', description: 'שם הפגישה/האירוע' }, date: { type: 'string', description: 'תאריך בפורמט YYYY-MM-DD' }, time: { type: 'string', description: 'שעת התחלה בפורמט HH:MM' }, duration_minutes: { type: 'integer', description: 'משך בדקות (ברירת מחדל 60)' }, notes: { type: 'string', description: 'הערות / תיאור הפגישה (אופציונלי)' } }, required: ['attendee_email', 'title', 'date', 'time'] } },
  { name: 'list_calendar_events', description: 'רשימת אירועים ביומן הארגון בטווח תאריכים (ברירת מחדל: 14 הימים הקרובים). השתמשי כדי למצוא event_id לפני עדכון/ביטול פגישה, או כשנשאלת "מה יש ביומן".', parameters: { type: 'object', properties: { date_from: { type: 'string', description: 'YYYY-MM-DD (ברירת מחדל היום)' }, date_to: { type: 'string', description: 'YYYY-MM-DD (ברירת מחדל +14 ימים)' }, search: { type: 'string', description: 'סינון טקסט חופשי (שם פגישה/משתתף)' } } } },
  { name: 'update_calendar_invite', description: 'עדכון פגישה/זימון קיים ביומן — הזזת מועד, שינוי כותרת או הערות. כל המשתתפים מקבלים מייל עדכון אוטומטי. חובה event_id (מ-list_calendar_events). לעדכון מועד ספקי date+time (שעון ישראל).', parameters: { type: 'object', properties: { event_id: { type: 'string' }, date: { type: 'string', description: 'YYYY-MM-DD' }, time: { type: 'string', description: 'HH:MM שעון ישראל' }, duration_minutes: { type: 'integer' }, title: { type: 'string' }, notes: { type: 'string' } }, required: ['event_id'] } },
  { name: 'cancel_calendar_invite', description: 'ביטול פגישה ביומן — המשתתפים מקבלים הודעת ביטול. חובה event_id (מ-list_calendar_events). בקשי אישור מהמשתמש לפני ביטול.', parameters: { type: 'object', properties: { event_id: { type: 'string' } }, required: ['event_id'] } },
  // ===========================
  // CAMPAIGNER MESSAGING
  // ===========================
  { name: 'send_message_to_campaigner', description: 'שליחת הודעת WhatsApp לחבר צוות/קמפיינר לפי campaigner_id. עדיף על send_whatsapp_via_gateway כשרוצים לשלוח לחבר צוות ולא יודעים את מספר הטלפון.', parameters: { type: 'object', properties: { campaigner_id: { type: 'string', description: 'מזהה הקמפיינר (UUID)' }, message_text: { type: 'string', description: 'תוכן ההודעה' } }, required: ['campaigner_id', 'message_text'] } },
]


// ===========================
// TOOL EXECUTOR
// ===========================

// ── Live Meta (Facebook) reads ──────────────────────────────────────────────
// The campaigner skill demands a LIVE audit before recommending, but the synced
// CRM tables can lag (some accounts were stuck months behind). These helpers read
// straight from the Graph API so list/get tools reflect the real account state,
// with a synced-table fallback so nothing regresses when live read isn't possible.
const FB_GRAPH_VERSION = 'v21.0'

async function fbResolveClientAdAccount(supabase: any, tenantId: string, clientId: string): Promise<string | null> {
  // 1. crm_tables (clients connected via the facebook sync/report-table flow).
  const { data } = await supabase
    .from('crm_tables')
    .select('integration_settings, last_sync_at')
    .eq('tenant_id', tenantId)
    .eq('client_id', clientId)
    .in('integration_type', ['facebook_insights', 'facebook_ecommerce'])
    .order('last_sync_at', { ascending: false, nullsFirst: false })
  for (const t of (data || [])) {
    const s = t?.integration_settings || {}
    const acc = s.ad_account_id || s.account_id || s.meta_account_id
    if (acc) return String(acc).replace(/^act_/, '')
  }
  // 2. Fallback: clients.meta_ads_account_id (the ad account set directly on the client record).
  const { data: cl } = await supabase
    .from('clients')
    .select('meta_ads_account_id')
    .eq('id', clientId)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (cl?.meta_ads_account_id) return String(cl.meta_ads_account_id).replace(/^act_/, '')
  return null
}

async function fbGetToken(supabase: any, tenantId: string): Promise<string | null> {
  let { data } = await supabase
    .from('tenant_integrations')
    .select('api_key, shared_from_integration_id')
    .in('integration_type', ['facebook', 'facebook_lead_ads'])
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .limit(1).maybeSingle()
  if (data && !data.api_key && data.shared_from_integration_id) {
    const { data: src } = await supabase.from('tenant_integrations').select('api_key').eq('id', data.shared_from_integration_id).maybeSingle()
    if (src?.api_key) data = { ...data, api_key: src.api_key }
  }
  return data?.api_key || null
}

// Pull the lead count out of an insights row's `actions` array (Meta reports leads
// under a few action types depending on the form/CAPI setup).
function fbLeadsFromActions(actions: any[]): number {
  if (!Array.isArray(actions)) return 0
  let leads = 0
  for (const a of actions) {
    const t = String(a?.action_type || '')
    if (t === 'lead' || t === 'leadgen.other' || t === 'onsite_conversion.lead_grouped' || t.endsWith('.lead')) {
      leads += Number(a?.value || 0)
    }
  }
  return leads
}

/** Live campaign list (id/name/status/objective). Returns null on any failure. */
async function fbLiveCampaignList(supabase: any, tenantId: string, clientId: string): Promise<any[] | null> {
  try {
    const acct = await fbResolveClientAdAccount(supabase, tenantId, clientId)
    const token = await fbGetToken(supabase, tenantId)
    if (!acct || !token) return null
    const url = `https://graph.facebook.com/${FB_GRAPH_VERSION}/act_${acct}/campaigns?fields=id,name,effective_status,objective&limit=300&access_token=${token}`
    const r = await fetch(url)
    const j = await r.json()
    if (!r.ok || j?.error || !Array.isArray(j?.data)) return null
    return j.data.map((c: any) => ({
      campaign_id: c.id, campaign_name: c.name,
      status: c.effective_status, effective_status: c.effective_status, objective: c.objective,
    }))
  } catch { return null }
}

/** Live campaign-level insights (spend/leads/etc.) over a day window. Null on failure. */
async function fbLiveCampaignInsights(supabase: any, tenantId: string, clientId: string, days: number): Promise<any[] | null> {
  try {
    const acct = await fbResolveClientAdAccount(supabase, tenantId, clientId)
    const token = await fbGetToken(supabase, tenantId)
    if (!acct || !token) return null
    const preset = days <= 1 ? 'yesterday' : days <= 7 ? 'last_7d' : days <= 14 ? 'last_14d' : days <= 30 ? 'last_30d' : days <= 90 ? 'last_90d' : 'maximum'
    const fields = 'campaign_id,campaign_name,impressions,clicks,spend,actions,cpc,cpm,ctr,reach'
    const url = `https://graph.facebook.com/${FB_GRAPH_VERSION}/act_${acct}/insights?level=campaign&date_preset=${preset}&fields=${fields}&limit=500&access_token=${token}`
    const r = await fetch(url)
    const j = await r.json()
    if (!r.ok || j?.error || !Array.isArray(j?.data)) return null
    return j.data.map((d: any) => {
      const leads = fbLeadsFromActions(d.actions)
      const spend = Number(d.spend || 0)
      return {
        campaign_id: d.campaign_id ?? null, campaign_name: d.campaign_name ?? null,
        impressions: Number(d.impressions || 0), clicks: Number(d.clicks || 0),
        spend, leads_count: leads,
        cpc: d.cpc ? Number(d.cpc) : null, cpm: d.cpm ? Number(d.cpm) : null, ctr: d.ctr ? Number(d.ctr) : null,
        reach: d.reach ? Number(d.reach) : null,
        cost_per_lead: leads > 0 ? Number((spend / leads).toFixed(2)) : null,
      }
    })
  } catch { return null }
}

function fbDatePreset(days: number): string {
  return days <= 1 ? 'yesterday' : days <= 7 ? 'last_7d' : days <= 14 ? 'last_14d' : days <= 30 ? 'last_30d' : days <= 90 ? 'last_90d' : 'maximum'
}

/** All ad accounts the token can see (id without act_ prefix + name). Null on failure. */
async function fbListAccessibleAdAccounts(token: string): Promise<Array<{ id: string; name: string; status: number | null }> | null> {
  try {
    const url = `https://graph.facebook.com/${FB_GRAPH_VERSION}/me/adaccounts?fields=account_id,name,account_status&limit=500&access_token=${token}`
    const r = await fetch(url)
    const j = await r.json()
    if (!r.ok || j?.error || !Array.isArray(j?.data)) return null
    return j.data.map((a: any) => ({
      id: String(a.account_id || a.id || '').replace(/^act_/, ''),
      name: String(a.name || ''),
      status: a.account_status != null ? Number(a.account_status) : null,
    })).filter((a: any) => a.id)
  } catch { return null }
}

// Conservative name match: normalize (lowercase, strip punctuation/whitespace) and
// accept only a strong match — exact, or one side fully contains the other with a
// length ratio >= 0.6 (so "fly" won't grab "flyaway studio"). Returns best or null.
function fbStrongMatchAccount(
  accounts: Array<{ id: string; name: string; status: number | null }>,
  clientName: string,
): { id: string; name: string } | null {
  const norm = (s: string) => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')
  const c = norm(clientName)
  if (c.length < 3) return null
  let best: { id: string; name: string; score: number } | null = null
  for (const a of accounts) {
    const n = norm(a.name)
    if (!n) continue
    let score = 0
    if (n === c) score = 1
    else if (n.includes(c) || c.includes(n)) {
      const ratio = Math.min(n.length, c.length) / Math.max(n.length, c.length)
      if (ratio >= 0.6) score = ratio
    }
    if (score > 0 && (!best || score > best.score)) best = { id: a.id, name: a.name, score }
  }
  return best ? { id: best.id, name: best.name } : null
}

/** Account-level live summary (spend/leads/cpl over a window). Null on failure. */
async function fbAccountInsights(token: string, acct: string, days: number): Promise<any | null> {
  try {
    const preset = fbDatePreset(days)
    const url = `https://graph.facebook.com/${FB_GRAPH_VERSION}/act_${acct}/insights?level=account&date_preset=${preset}&fields=spend,impressions,clicks,actions,reach&limit=1&access_token=${token}`
    const r = await fetch(url)
    const j = await r.json()
    if (!r.ok || j?.error || !Array.isArray(j?.data)) return null
    const d = j.data[0]
    if (!d) return { spend: 0, leads_count: 0, impressions: 0, clicks: 0, cost_per_lead: null, no_delivery: true }
    const leads = fbLeadsFromActions(d.actions)
    const spend = Number(d.spend || 0)
    return {
      spend, leads_count: leads,
      impressions: Number(d.impressions || 0), clicks: Number(d.clicks || 0),
      reach: d.reach ? Number(d.reach) : null,
      cost_per_lead: leads > 0 ? Number((spend / leads).toFixed(2)) : null,
    }
  } catch { return null }
}

// Try-to-connect pass: for every client we could NOT report from synced data,
// attempt a LIVE pull. Mapped-but-stale clients resolve via their crm config;
// truly-unmapped clients are matched by name against the token's ad accounts
// (strong match only, flagged matched_by:'name' for human verification). Returns
// the clients we connected live vs the ones that still need manual linking.
async function fbTryConnectClients(
  supabase: any,
  tenantId: string,
  notConnected: Array<{ client_id: string; client_name: string; reason: string }>,
  days: number,
): Promise<{ connected: any[]; stillNotConnected: any[] }> {
  const connected: any[] = []
  const stillNotConnected: any[] = []
  const token = await fbGetToken(supabase, tenantId)
  let accounts: Array<{ id: string; name: string; status: number | null }> | null = null
  for (const nc of notConnected) {
    let acct = await fbResolveClientAdAccount(supabase, tenantId, nc.client_id)
    let matchedBy: 'config' | 'name' | null = acct ? 'config' : null
    let matchedName: string | null = null
    if (!acct && token) {
      if (accounts === null) accounts = (await fbListAccessibleAdAccounts(token)) || []
      const m = fbStrongMatchAccount(accounts, nc.client_name)
      if (m) { acct = m.id; matchedBy = 'name'; matchedName = m.name }
    }
    if (acct && token) {
      const ins = await fbAccountInsights(token, acct, days)
      if (ins) {
        connected.push({
          client_id: nc.client_id, client_name: nc.client_name,
          ad_account: `act_${acct}`, matched_by: matchedBy, matched_account_name: matchedName,
          ...ins, source: 'live_meta',
        })
        continue
      }
    }
    stillNotConnected.push({
      client_id: nc.client_id, client_name: nc.client_name,
      reason: nc.reason,
      connect_attempt: !token ? 'no_fb_token' : (acct ? 'account_found_but_no_data' : 'no_matching_ad_account'),
    })
  }
  return { connected, stillNotConnected }
}

async function getAccessibleTenantIds(supabase: any, tenantId: string): Promise<string[]> {
  try {
    const { data } = await supabase
      .from('agency_tenant_access')
      .select('source_tenant_id')
      .eq('accessing_tenant_id', tenantId)
    const extra = (data || []).map((r: any) => r.source_tenant_id).filter(Boolean)
    return Array.from(new Set([tenantId, ...extra]))
  } catch (_) {
    return [tenantId]
  }
}

// Auto-create a Google Calendar event for a newly created task.
// Silently no-ops when the campaigner's user has no connected calendar.
async function tryCreateCalendarEventForTask(
  supabase: any,
  taskId: string,
  title: string,
  dueDate: string,
  dueTime: string,
  durationMinutes: number | null,
  campaignerId: string,
): Promise<void> {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('campaigner_id', campaignerId)
      .maybeSingle()
    if (!profile?.id) return

    const { data: tokenData } = await supabase
      .from('calendar_tokens')
      .select('access_token, refresh_token, expires_at')
      .eq('user_id', profile.id)
      .maybeSingle()
    if (!tokenData) return

    let accessToken = tokenData.access_token
    if (new Date(tokenData.expires_at) <= new Date()) {
      const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
      const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')
      if (!clientId || !clientSecret) return
      const r = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId, client_secret: clientSecret,
          refresh_token: tokenData.refresh_token, grant_type: 'refresh_token',
        }),
      })
      const rd = await r.json()
      if (!rd.access_token) return
      accessToken = rd.access_token
      await supabase.from('calendar_tokens').update({
        access_token: accessToken,
        expires_at: new Date(Date.now() + rd.expires_in * 1000).toISOString(),
      }).eq('user_id', profile.id)
    }

    const start = new Date(`${dueDate}T${dueTime}`)
    const end = new Date(start.getTime() + (durationMinutes || 30) * 60_000)
    const calResp = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events',
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary: title,
          description: 'משימה ממערכת AIOS',
          start: { dateTime: start.toISOString(), timeZone: 'Asia/Jerusalem' },
          end: { dateTime: end.toISOString(), timeZone: 'Asia/Jerusalem' },
        }),
      }
    )
    if (calResp.ok) {
      const ev = await calResp.json()
      if (ev.id) await supabase.from('tasks').update({ google_calendar_event_id: ev.id }).eq('id', taskId)
    } else {
      const e = await calResp.json().catch(() => ({}))
      console.warn('[create_task] calendar event failed:', calResp.status, e?.error?.message)
    }
  } catch (e: any) {
    console.warn('[create_task] calendar sync error:', e?.message)
  }
}

async function executeTool(name: string, args: Record<string, any>, supabase: any, tenantId: string, userId: string, callerCampaignerId?: string | null, agentId?: string | null, callerRole?: string | null, callerManagedAgencyIds?: string[] | null, callerPhone?: string | null, waNotify?: any): Promise<any> {
  const accessibleTenantIds = await getAccessibleTenantIds(supabase, tenantId)
  // Role-based scope: managers (owner/agency_owner/agency_manager/super_admin) bypass the campaigner narrow-scope.
  const isManagerRole = !!callerRole && ['owner','agency_owner','agency_manager','super_admin'].includes(callerRole)
  const isTeamManager = callerRole === 'team_manager'
  const managedAgencyIds = Array.isArray(callerManagedAgencyIds) ? callerManagedAgencyIds : []
  // Effective scope flag — true means "do not narrow to a single caller campaigner"
  const bypassCampaignerScope = isManagerRole || (isTeamManager && managedAgencyIds.length > 0)
  // Caller-scope bundle for assertCallerCanAccessClient (client-scoped mutations).
  const callerScope = { callerCampaignerId, isManagerRole, isTeamManager, managedAgencyIds, accessibleTenantIds }
  switch (name) {
    case 'query_system_graph': {
      if (!isManagerRole) throw new Error('אין הרשאה לעיין בגרף המערכת')
      const query = String(args.query || '').trim()
      if (!query) throw new Error('query is required')
      const { data, error } = await supabase.rpc('carmen_query_system_graph', {
        p_query: query,
        p_depth: Math.min(3, Math.max(0, Number(args.depth ?? 2))),
        p_limit: Math.min(80, Math.max(1, Number(args.limit ?? 40))),
      })
      if (error) throw error
      return { count: data?.length || 0, nodes: data || [], read_only: true }
    }
    case 'create_lead': {
      const { data: agency } = await supabase.from('agencies').select('id').in('tenant_id', accessibleTenantIds).limit(1).single()
      const { data, error } = await supabase.from('leads').insert({
        ...args, status: 'new', agency_id: agency?.id, tenant_id: tenantId,
        company_name: args.company_name || args.contact_name,
      }).select('id, company_name, contact_name, status').single()
      if (error) throw error
      return { lead_id: data.id, company_name: data.company_name, status: data.status }
    }
    case 'list_leads': {
      let query = supabase.from('leads').select('id, company_name, contact_name, phone, status, source, created_at').in('tenant_id', accessibleTenantIds).order('created_at', { ascending: false }).limit(args.limit || 20)
      if (args.status) query = query.eq('status', args.status)
      const { data, error } = await query
      if (error) throw error
      return { count: data.length, leads: data }
    }
    case 'update_lead_status': {
      const { data, error } = await supabase.from('leads').update({ status: args.status }).eq('id', args.lead_id).in('tenant_id', accessibleTenantIds).select('id, company_name, status').single()
      if (error) throw error
      return data
    }
    case 'add_lead_update': {
      const { data, error } = await supabase.from('lead_updates').insert({ lead_id: args.lead_id, user_id: userId, tenant_id: tenantId, content: args.content }).select('id').single()
      if (error) throw error
      return { update_id: data.id }
    }
    case 'create_task': {
      let campaignerId = args.campaigner_id
      let agencyId = null
      // Priority: 1) explicit arg, 2) caller identity (from WhatsApp phone), 3) user profile, 4) tenant owner
      if (!campaignerId && callerCampaignerId) {
        campaignerId = callerCampaignerId
      }
      if (!campaignerId && userId && userId !== 'system') {
        const { data: profile } = await supabase.from('profiles').select('campaigner_id').eq('id', userId).single()
        campaignerId = profile?.campaigner_id
      }
      // Fallback for system/WhatsApp without phone match: assign to tenant owner
      if (!campaignerId) {
        const { data: ownerRole } = await supabase.from('user_roles').select('user_id').eq('role', 'owner').limit(1).maybeSingle()
        if (ownerRole?.user_id) {
          const { data: ownerProfile } = await supabase.from('profiles').select('campaigner_id').eq('id', ownerRole.user_id).maybeSingle()
          campaignerId = ownerProfile?.campaigner_id
        }
      }
      if (campaignerId) {
        const { data: campAgency } = await supabase.from('campaigner_agencies').select('agency_id').eq('campaigner_id', campaignerId).limit(1).single()
        agencyId = campAgency?.agency_id
      }
      if (!agencyId) {
        const { data: defaultAgency } = await supabase.from('agencies').select('id').in('tenant_id', accessibleTenantIds).eq('is_default', true).limit(1).maybeSingle()
        if (defaultAgency) {
          agencyId = defaultAgency.id
        } else {
          const { data: fallbackAgency } = await supabase.from('agencies').select('id').in('tenant_id', accessibleTenantIds).order('created_at', { ascending: true }).limit(1).single()
          agencyId = fallbackAgency?.id
        }
      }
      const { data, error } = await supabase.from('tasks').insert({
        title: args.title, agency_id: agencyId, campaigner_id: campaignerId,
        tenant_id: tenantId, priority: args.priority || 5, status: 'open', task_type: 'other',
        client_id: args.client_id || null, lead_id: args.lead_id || null,
        due_date: args.due_date, due_time: args.due_time, notes: args.notes,
        duration_minutes: args.duration_minutes || null,
      }).select('id, title, status').single()
      if (error) throw error
      // Auto-sync to Google Calendar — fire-and-forget; never fails the create_task call
      if (data?.id && args.due_date && args.due_time && campaignerId) {
        tryCreateCalendarEventForTask(
          supabase, data.id, args.title, args.due_date, args.due_time, args.duration_minutes ?? null, campaignerId
        ).catch(e => console.warn('[create_task] calendar sync uncaught:', e?.message))
      }
      return { task_id: data.id, title: data.title, status: data.status }
    }
    case 'create_agent_task': {
      // Create task in agent_tasks table (for Carmen herself)
      // If this looks like a reminder and we know the caller's WhatsApp phone,
      // inject explicit reminder-delivery instructions so when the dispatcher
      // fires the task, the agent knows where to send the reminder.
      const skillsArr: string[] = Array.isArray(args.task_skills) ? args.task_skills : []
      const titleStr = String(args.title || '')
      const descStr = String(args.description || '')
      const looksLikeReminder = skillsArr.includes('reminder')
        || /תזכור|reminder|להזכיר|תזכר/i.test(titleStr + ' ' + descStr)
      let finalDescription = descStr || null
      if (looksLikeReminder && callerPhone) {
        const reminderText = descStr || titleStr
        const instruction = `\n\n[הוראת ביצוע אוטומטית לזמן ההפעלה]\nכשמשימה זו רצה, חובה לשלוח עכשיו הודעת WhatsApp תזכורת לטלפון ${callerPhone} עם הטקסט בעברית, בקצרה ובחום:\n"${reminderText}"\nהשתמשי בכלי send_whatsapp_via_gateway (אם יש integrationId זמין) או send_message (אם phone=${callerPhone} שייך ל-lead/client). אם אף כלי לא זמין — השתמשי בכל כלי WhatsApp אחר שיש לך. אסור לסיים את המשימה בלי לשלוח בפועל. אל תיצרי משימת agent חדשה.`
        finalDescription = (descStr ? descStr : titleStr) + instruction
      }
      const taskData: any = {
        agent_id: agentId || args.agent_id,
        tenant_id: tenantId,
        title: args.title,
        description: finalDescription,
        priority: args.priority || 5,
        status: 'pending',
        schedule_type: args.schedule_type || 'once',
        scheduled_at: args.scheduled_at || null,
        cron_expression: args.cron_expression || null,
        task_skills: args.task_skills ? JSON.stringify(args.task_skills) : null,
        task_mode: 'agent',
        enabled: true,
        created_by: userId !== 'system' ? userId : null,
      }
      const { data, error } = await supabase.from('agent_tasks').insert(taskData).select('id, title, status, schedule_type, scheduled_at').single()
      if (error) throw error
      const scheduledIl = data.scheduled_at
        ? new Date(data.scheduled_at).toLocaleString('he-IL', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem' })
        : null
      return { agent_task_id: data.id, title: data.title, status: data.status, schedule_type: data.schedule_type, scheduled_at_utc: data.scheduled_at, scheduled_at_israel: scheduledIl, reminder_phone: looksLikeReminder ? callerPhone : null, note: scheduledIl ? `המשימה תוזמנה ל-${scheduledIl} (שעון ישראל). השיבי למשתמש את הזמן בשעון ישראל בלבד.` : 'נשמר ללא תזמון.' }
    }
    case 'list_my_agent_tasks': {
      let q = supabase.from('agent_tasks')
        .select('id, title, description, status, schedule_type, scheduled_at, last_run, run_count, result, created_at')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(args.limit || 10)
      if (agentId) q = q.eq('agent_id', agentId)
      if (args.status) q = q.eq('status', args.status)
      const { data, error } = await q
      if (error) throw error
      const fmtIl = (iso: string | null) => iso ? new Date(iso).toLocaleString('he-IL', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem' }) : null
      return {
        count: data.length,
        tasks: data.map((t: any) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          schedule_type: t.schedule_type,
          scheduled_at_israel: fmtIl(t.scheduled_at),
          last_run_israel: fmtIl(t.last_run),
          run_count: t.run_count || 0,
          last_output: t.result?.last_output ? String(t.result.last_output).slice(0, 200) : (t.result?.error ? `שגיאה: ${String(t.result.error).slice(0,200)}` : null),
          description_preview: t.description ? String(t.description).slice(0, 120) : null,
        })),
      }
    }
    case 'recall_recent_action': {
      // Check if Carmen already performed an action recently — used before heavy
      // operations (pulse_check, campaign_analysis, lead_review) so she doesn't
      // re-run the same work and can answer "I already did it at HH:MM".
      const action = String(args.action_type || '').trim()
      const maxHours = Math.max(1, Math.min(168, Number(args.max_age_hours) || 8))
      const since = new Date(Date.now() - maxHours * 60 * 60 * 1000).toISOString()
      let q = supabase.from('carmen_memory_episodes')
        .select('id, topic, topic_tags, summary, importance, ref_date, created_at')
        .eq('tenant_id', tenantId)
        .gte('ref_date', since)
        .order('ref_date', { ascending: false })
        .limit(3)
      if (action) q = q.or(`topic.ilike.%${action}%,topic_tags.cs.{${action}}`)
      const { data, error } = await q
      if (error) throw error
      const fmtIl = (iso: string | null) => iso ? new Date(iso).toLocaleString('he-IL', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem' }) : null
      return {
        found: data.length > 0,
        recent_episodes: data.map((e: any) => ({
          id: e.id,
          topic: e.topic,
          topic_tags: e.topic_tags,
          summary: e.summary,
          when_israel: fmtIl(e.ref_date || e.created_at),
          importance: e.importance,
        })),
        guidance: data.length > 0
          ? 'יש פעולה דומה שנעשתה לאחרונה. אסור לחזור עליה מחדש אלא אם המשתמש ביקש "רענני" / "עכשיו" / "בזמן אמת". ענו עם הסיכום הקיים, ציינו את הזמן, ושאלו אם לרענן.'
          : 'אין רישום מ-N השעות האחרונות. אפשר להריץ את הפעולה.',
      }
    }
    case 'record_action_episode': {
      // Persist a heavy-action result into long-term memory so future calls
      // hit recall_recent_action instead of re-running.
      const topic = String(args.action_type || args.topic || '').trim()
      if (!topic) throw new Error('action_type required')
      const summary = String(args.summary || '').slice(0, 4000)
      if (!summary) throw new Error('summary required')
      const tags = Array.isArray(args.topic_tags) && args.topic_tags.length > 0
        ? args.topic_tags
        : [topic]
      const importance = Math.max(1, Math.min(100, Number(args.importance) || 50))
      const { data, error } = await supabase.from('carmen_memory_episodes').insert({
        tenant_id: tenantId,
        topic,
        topic_tags: tags,
        summary,
        importance,
        ref_date: new Date().toISOString(),
        source_table: 'agent_runs',
        participants: callerPhone ? { caller_phone: callerPhone } : {},
      }).select('id').single()
      if (error) throw error
      return { episode_id: data.id, recorded: true }
    }
    case 'search_tasks': {
      let query = supabase.from('tasks').select('id, title, status, priority, due_date, due_time, notes, duration_minutes, clients(name), leads(company_name), campaigners(full_name)')
        .in('tenant_id', accessibleTenantIds)
        .ilike('title', `%${args.search_term}%`)
        .order('created_at', { ascending: false })
        .limit(10)
      if (args.status) query = query.eq('status', args.status)
      if (args.client_id) query = query.eq('client_id', args.client_id)
      const { data, error } = await query
      if (error) throw error
      return { count: data.length, tasks: data.map((t: any) => ({ ...t, client_name: t.clients?.name, lead_name: t.leads?.company_name, campaigner_name: t.campaigners?.full_name })) }
    }
    case 'list_tasks': {
      let query = supabase.from('tasks').select('id, title, status, priority, due_date, due_time, duration_minutes, clients(name), leads(company_name), campaigners(full_name)').in('tenant_id', accessibleTenantIds).order('priority', { ascending: false }).limit(args.limit || 20)
      if (args.status) query = query.eq('status', args.status)
      if (args.client_id) {
        if (callerCampaignerId && !bypassCampaignerScope) await assertCallerCanAccessClient(supabase, args.client_id, callerScope)
        query = query.eq('client_id', args.client_id)
      } else if (callerCampaignerId && !bypassCampaignerScope) {
        const { data: links } = await supabase.from('client_team').select('client_id').eq('campaigner_id', callerCampaignerId)
        const ids = (links || []).map((l: any) => l.client_id)
        query = ids.length > 0
          ? query.or(`client_id.is.null,client_id.in.(${ids.join(',')})`)
          : query.is('client_id', null)
      }
      const { data, error } = await query
      if (error) throw error
      return { count: data.length, tasks: data.map((t: any) => ({ ...t, client_name: t.clients?.name, lead_name: t.leads?.company_name, campaigner_name: t.campaigners?.full_name })) }
    }
    case 'update_task_status': {
      await assertCallerCanAccessEntityClient(supabase, 'tasks', args.task_id, callerScope)
      const { data, error } = await supabase.from('tasks').update({ status: args.status }).eq('id', args.task_id).in('tenant_id', accessibleTenantIds).select('id, title, status').single()
      if (error) throw error
      return data
    }
    case 'list_clients': {
      // --- Scoping rules ---
      // 1. agency_id / agency_name → resolve to agency UUIDs (must be in accessible tenants)
      let agencyIdsFilter: string[] | null = null
      if (args.agency_id) {
        agencyIdsFilter = [args.agency_id]
      } else if (args.agency_name) {
        const { data: ags } = await supabase
          .from('agencies').select('id, name')
          .in('tenant_id', accessibleTenantIds)
          .ilike('name', `%${args.agency_name}%`)
        agencyIdsFilter = (ags || []).map((a: any) => a.id)
        if (agencyIdsFilter.length === 0) {
          return { count: 0, clients: [], note: `no agency matched "${args.agency_name}"` }
        }
      }

      // 2. campaigner filter (explicit OR auto-scope to caller)
      let campaignerIds: string[] | null = null
      const explicitCampaigner = !!(args.campaigner_id || args.campaigner_name)
      if (args.campaigner_id) {
        campaignerIds = [args.campaigner_id]
      } else if (args.campaigner_name) {
        const { data: camps } = await supabase
          .from('campaigners').select('id, full_name')
          .in('tenant_id', accessibleTenantIds)
          .ilike('full_name', `%${args.campaigner_name}%`)
        campaignerIds = (camps || []).map((c: any) => c.id)
        if (campaignerIds.length === 0) {
          return { count: 0, clients: [], note: `no campaigner matched "${args.campaigner_name}"` }
        }
      } else if (callerCampaignerId && !args.all_scopes && !agencyIdsFilter && !bypassCampaignerScope) {
        // Auto-scope: a campaigner asking via WhatsApp should only see their own clients
        campaignerIds = [callerCampaignerId]
      } else if (isTeamManager && !args.all_scopes && !agencyIdsFilter && managedAgencyIds.length > 0) {
        // Team manager scope: limit to clients within agencies they manage
        agencyIdsFilter = managedAgencyIds
      }

      let clientIdsFilter: string[] | null = null
      if (campaignerIds) {
        const { data: links, error: linkErr } = await supabase
          .from('client_team').select('client_id')
          .in('campaigner_id', campaignerIds)
        if (linkErr) throw linkErr
        clientIdsFilter = Array.from(new Set((links || []).map((l: any) => l.client_id)))
        if (clientIdsFilter.length === 0) {
          const who = explicitCampaigner ? 'this campaigner' : 'you'
          return { count: 0, clients: [], note: `no clients assigned to ${who}` }
        }
      }

      let query = supabase.from('clients')
        .select('id, name, contact_name, phone, status, agency_id, agencies(name)')
        .in('tenant_id', accessibleTenantIds).order('name').limit(args.limit || 50)

      // Default status for auto-scoped campaigner queries: active + onboarding only
      if (args.status) {
        query = query.eq('status', args.status)
      } else if (callerCampaignerId && !args.all_scopes && !explicitCampaigner) {
        query = query.in('status', ['active', 'onboarding'])
      }

      if (agencyIdsFilter) query = query.in('agency_id', agencyIdsFilter)
      if (clientIdsFilter) query = query.in('id', clientIdsFilter)
      if (args.name_search) {
        const term = String(args.name_search).trim().replace(/[%_]/g, '')
        query = query.or(`name.ilike.%${term}%,contact_name.ilike.%${term}%`)
      }
      const { data, error } = await query
      if (error) throw error
      const enriched = (data || []).map((c: any) => ({
        id: c.id, name: c.name, contact_name: c.contact_name, phone: c.phone,
        status: c.status, agency_id: c.agency_id, agency_name: c.agencies?.name ?? null,
      }))
      const scope_note = (callerCampaignerId && !args.all_scopes && !explicitCampaigner && !agencyIdsFilter)
        ? 'auto-scoped to caller campaigner (active+onboarding only). pass all_scopes=true or explicit campaigner_name/agency_name to widen.'
        : undefined
      return { count: enriched.length, clients: enriched, scope_note }
    }
    case 'get_client_info': {
      const { data, error } = await supabase.from('clients').select('*, agencies(name)').eq('id', args.client_id).in('tenant_id', accessibleTenantIds).single()
      if (error) throw error
      // Enforce caller-campaigner scope: campaigner only; managers bypass.
      if (callerCampaignerId && !args.all_scopes && !bypassCampaignerScope) {
        const { data: link } = await supabase
          .from('client_team').select('client_id')
          .eq('client_id', args.client_id).eq('campaigner_id', callerCampaignerId).maybeSingle()
        if (!link) {
          return { error: 'access_denied', note: 'הלקוח הזה לא משוייך אליך. אם נדרשת גישה — בקש מהמנהל לשייך אותך לצוות הלקוח.' }
        }
      } else if (isTeamManager && !args.all_scopes && managedAgencyIds.length > 0) {
        if (!data?.agency_id || !managedAgencyIds.includes(data.agency_id)) {
          return { error: 'access_denied', note: 'הלקוח לא בסוכנויות שאת מנהלת.' }
        }
      }
      return data
    }
    case 'add_client_update': {
      await assertCallerCanAccessClient(supabase, args.client_id, callerScope)
      const { data, error } = await supabase.from('client_updates').insert({ client_id: args.client_id, user_id: userId, tenant_id: tenantId, content: args.content }).select('id').single()
      if (error) throw error
      return { update_id: data.id }
    }
    case 'send_message': {
      let phone: string | null = null
      let contactName: string | null = null
      if (args.contact_type === 'lead') {
        const { data } = await supabase.from('leads').select('phone, company_name, contact_name').eq('id', args.contact_id).single()
        phone = data?.phone; contactName = data?.contact_name || data?.company_name
      } else {
        const { data } = await supabase.from('clients').select('phone, name, contact_name').eq('id', args.contact_id).single()
        phone = data?.phone; contactName = data?.contact_name || data?.name
      }
      if (!phone) return { success: false, error: 'לא נמצא מספר טלפון' }
      const res = await fetch(`${SUPABASE_URL}/functions/v1/send-green-api-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
        body: JSON.stringify({ phone, message: args.message_text, tenantId, [`${args.contact_type}_id`]: args.contact_id }),
      })
      if (!res.ok) throw new Error(await res.text())
      return { sent_to: contactName, phone }
    }
    case 'search_entities': {
      const tableMap: Record<string, string> = { agency: 'agencies', client: 'clients', campaigner: 'campaigners', lead: 'leads' }
      const nameMap: Record<string, string> = { agency: 'name', client: 'name', campaigner: 'full_name', lead: 'company_name' }
      const table = tableMap[args.entity_type]
      const nameField = nameMap[args.entity_type]
      const selectCols = args.entity_type === 'client' || args.entity_type === 'lead'
        ? `id, ${nameField}, agency_id`
        : `id, ${nameField}`
      let q = supabase.from(table).select(selectCols).in('tenant_id', accessibleTenantIds).ilike(nameField, `%${args.search_term}%`).limit(20)
      if ((args.entity_type === 'client' || args.entity_type === 'lead') && args.agency_id) {
        q = q.eq('agency_id', args.agency_id)
      }
      // Auto-scope clients to caller campaigner unless overridden; managers bypass.
      if (args.entity_type === 'client' && callerCampaignerId && !args.all_scopes && !bypassCampaignerScope) {
        const { data: links } = await supabase.from('client_team').select('client_id').eq('campaigner_id', callerCampaignerId)
        const ids = (links || []).map((l: any) => l.client_id)
        if (ids.length === 0) return { count: 0, results: [], note: 'no clients assigned to you' }
        q = q.in('id', ids)
      } else if (args.entity_type === 'client' && isTeamManager && !args.all_scopes && managedAgencyIds.length > 0) {
        q = q.in('agency_id', managedAgencyIds)
      }
      const { data, error } = await q
      if (error) throw error
      return { count: data.length, results: data }
    }
    case 'delegate_to_manus': {
      // Call the existing manus-api edge function
      const manusBody: any = {
        action: 'create_task',
        tenantId,
        prompt: args.prompt,
      }
      if (args.context_data) {
        manusBody.prompt = `${args.prompt}\n\nנתוני הקשר:\n${args.context_data}`
      }

      const manusRes = await fetch(`${SUPABASE_URL}/functions/v1/manus-api`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify(manusBody),
      })

      if (!manusRes.ok) {
        const errText = await manusRes.text()
        let parsed: any = null
        try { parsed = JSON.parse(errText) } catch { /* ignore */ }
        const detail = parsed?.error || errText
        // Distinguish between local config errors and real Manus API errors
        if (manusRes.status === 400 && /not configured|key not found/i.test(String(detail))) {
          throw new Error(`Manus לא מוגדר עבור הטננט הזה: ${detail}. הוסיפי מפתח API בהגדרות אינטגרציות → Manus.`)
        }
        if (manusRes.status === 401) {
          throw new Error(`Manus auth failed (internal): ${detail}`)
        }
        throw new Error(`Manus API error [${manusRes.status}]: ${detail}`)
      }

      const manusData = await manusRes.json()
      return {
        success: true,
        task_id: manusData.task_id,
        task_url: manusData.task_url,
        share_url: manusData.share_url,
        message: 'המשימה נשלחה ל-Manus AI ורצה ברקע. תוכל לעקוב אחריה בהגדרות Manus.',
      }
    }

    case 'send_message_to_manus': {
      const manusApiUrl = `${SUPABASE_URL}/functions/v1/manus-api`
      const msgBody: any = {
        action: 'send_message',
        tenantId,
        message: args.message,
      }
      if (args.task_id) msgBody.task_id = args.task_id
      const msgRes = await fetch(manusApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify(msgBody),
      })
      if (!msgRes.ok) {
        const errText = await msgRes.text()
        throw new Error(`Manus send_message error [${msgRes.status}]: ${errText}`)
      }
      const msgData = await msgRes.json()
      return {
        success: true,
        task_id: msgData.task_id,
        message: 'ההודעה נשלחה ל-Manus בהצלחה.',
      }
    }

    case 'get_facebook_campaign_data': {
      if (args.client_id) await assertCallerCanAccessClient(supabase, args.client_id, callerScope)
      const daysBack = args.days || 30
      const sinceDate = new Date()
      sinceDate.setDate(sinceDate.getDate() - daysBack)
      const sinceDateStr = sinceDate.toISOString().split('T')[0]

      if (!args.client_id) {
        return { error: 'client_id_required', message: 'יש להעביר client_id' }
      }

      // LIVE first: pull campaign-level insights straight from Meta (synced tables can lag days/weeks).
      const liveInsights = await fbLiveCampaignInsights(supabase, accessibleTenantIds[0], args.client_id, daysBack)
      if (liveInsights) {
        return { count: liveInsights.length, campaigns: liveInsights, period: `${daysBack} days`, source: 'live_meta' }
      }

      // Fallback: CRM dynamic tables that hold synced FB insights.
      const { data: campaignTables, error: rpcErr } = await supabase
        .rpc('find_campaign_tables', { p_client_ids: [args.client_id] })
      if (rpcErr) throw rpcErr
      const tableIds = (campaignTables || []).map((t: any) => t.table_id)
      if (tableIds.length === 0) {
        return { count: 0, campaigns: [], period: `${daysBack} days`, note: 'no_campaign_table_for_client' }
      }

      const { data: records, error } = await supabase
        .from('crm_records').select('data')
        .in('table_id', tableIds)
        .in('tenant_id', accessibleTenantIds)
      if (error) throw error

      const rows = (records || [])
        .map((r: any) => r.data || {})
        .filter((d: any) => d.date && d.date >= sinceDateStr)
        .sort((a: any, b: any) => (b.date || '').localeCompare(a.date || ''))
        .slice(0, 500)
        .map((d: any) => ({
          campaign_id: d.campaign_id ?? null,
          campaign_name: d.campaign_name ?? null,
          date: d.date ?? null,
          impressions: d.impressions ?? null,
          clicks: d.clicks ?? null,
          spend: d.spend ?? d.cost ?? null,
          leads_count: d.leads ?? d.leads_count ?? d.form_leads ?? null,
          reach: d.reach ?? null,
          cpc: d.cpc ?? null,
          cpm: d.cpm ?? null,
          ctr: d.ctr ?? null,
          cost_per_lead: d.cost_per_lead ?? d.cpl ?? null,
          campaign_status: d.effective_status ?? d.campaign_status ?? d.configured_status ?? null,
        }))
      return { count: rows.length, campaigns: rows, period: `${daysBack} days` }
    }
    case 'list_facebook_campaigns': {
      if (args.client_id) await assertCallerCanAccessClient(supabase, args.client_id, callerScope)
      if (!args.client_id) {
        return { error: 'client_id_required', message: 'יש להעביר client_id' }
      }
      // LIVE first: read campaign status straight from Meta (synced tables can lag).
      const liveList = await fbLiveCampaignList(supabase, accessibleTenantIds[0], args.client_id)
      if (liveList) {
        const search = (args.name_search || '').toString().toLowerCase()
        const campaigns = search ? liveList.filter((c: any) => String(c.campaign_name || '').toLowerCase().includes(search)) : liveList
        return { count: campaigns.length, campaigns, source: 'live_meta' }
      }
      // Fallback: CRM dynamic tables that hold synced FB insights with status.
      const { data: campaignTables, error: rpcErr } = await supabase
        .rpc('find_campaign_tables', { p_client_ids: [args.client_id] })
      if (rpcErr) throw rpcErr
      const tableIds = (campaignTables || []).map((t: any) => t.table_id)
      if (tableIds.length === 0) {
        return { count: 0, campaigns: [], note: 'no_campaign_table_for_client — חבר טבלת קמפיינים ללקוח (Meta Ads sync).' }
      }

      const { data: records, error } = await supabase
        .from('crm_records').select('data')
        .in('table_id', tableIds)
        .in('tenant_id', accessibleTenantIds)
      if (error) throw error

      const search = (args.name_search || '').toString().toLowerCase()
      // Dedup by campaign_id, keep row with most recent date
      const map = new Map<string, any>()
      for (const r of (records || [])) {
        const d = r.data || {}
        const cid = d.campaign_id
        if (!cid) continue
        const name = d.campaign_name || ''
        if (search && !String(name).toLowerCase().includes(search)) continue
        const status = d.effective_status ?? d.campaign_status ?? d.configured_status ?? null
        const date = d.date || ''
        const existing = map.get(cid)
        if (!existing || (date > (existing.last_date || ''))) {
          map.set(cid, {
            campaign_id: cid,
            campaign_name: name,
            status,
            effective_status: d.effective_status ?? null,
            configured_status: d.configured_status ?? null,
            last_date: date || null,
          })
        }
      }
      const campaigns = Array.from(map.values()).sort((a, b) => (b.last_date || '').localeCompare(a.last_date || ''))
      return { count: campaigns.length, campaigns }
    }
    case 'toggle_facebook_campaign': {
      if (args.confirmed !== true) {
        return { error: 'not_confirmed', message: 'אישור משתמש מפורש נדרש. שאל את המשתמש לפני קריאה לכלי הזה ושלח confirmed=true רק אחרי שהוא אישר.' }
      }
      await assertCallerCanAccessClient(supabase, args.client_id, callerScope)
      const targetTenantId = accessibleTenantIds[0]
      const fnUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/toggle-facebook-campaign`
      const res = await fetch(fnUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({
          tenant_id: targetTenantId,
          campaign_id: args.campaign_id,
          status: args.status,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) return { error: 'toggle_failed', details: json }
      return { success: true, campaign_id: args.campaign_id, new_status: args.status, fb: json }
    }
    case 'analyze_facebook_campaign': {
      await assertCallerCanAccessClient(supabase, args.client_id, callerScope)
      const targetTenantId = accessibleTenantIds[0]
      const fnUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/fb-campaign-analyze`
      const res = await fetch(fnUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` },
        body: JSON.stringify({ tenant_id: targetTenantId, campaign_id: args.campaign_id }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) return { error: 'analyze_failed', details: json }
      return json
    }
    case 'update_facebook_budget':
    case 'duplicate_facebook_campaign': {
      if (args.confirmed !== true) {
        return { error: 'not_confirmed', message: 'אישור משתמש מפורש נדרש (confirmed=true).' }
      }
      await assertCallerCanAccessClient(supabase, args.client_id, callerScope)
      const targetTenantId = accessibleTenantIds[0]
      const action = name === 'update_facebook_budget' ? 'update_budget' : 'duplicate'
      const fnUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/fb-campaign-control`
      const res = await fetch(fnUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` },
        body: JSON.stringify({
          tenant_id: targetTenantId,
          action,
          campaign_id: args.campaign_id,
          daily_budget: args.daily_budget,
          lifetime_budget: args.lifetime_budget,
          name_suffix: args.name_suffix,
          confirmed: true,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) return { error: `${action}_failed`, details: json }
      return json
    }
    case 'get_campaign_alerts': {
      let q = supabase.from('campaign_alerts')
        .select('id, tenant_id, client_id, campaign_id, campaign_name, alert_type, severity, details, created_at, acknowledged_at, resolved_at')
        .in('tenant_id', accessibleTenantIds)
        .order('created_at', { ascending: false })
        .limit(100)
      if (args.client_id) q = q.eq('client_id', args.client_id)
      if (args.severity) q = q.eq('severity', args.severity)
      if (args.only_open !== false) q = q.is('resolved_at', null).is('acknowledged_at', null)
      const { data, error } = await q
      if (error) return { error: error.message }
      return { count: data?.length || 0, alerts: data || [] }
    }
    case 'acknowledge_campaign_alert': {
      const { error } = await supabase.from('campaign_alerts')
        .update({ acknowledged_at: new Date().toISOString() })
        .eq('id', args.alert_id)
        .in('tenant_id', accessibleTenantIds)
      if (error) return { error: error.message }
      return { success: true, alert_id: args.alert_id }
    }
    case 'list_social_pages': {
      let q = supabase.from('social_pages').select('id, platform, page_id, page_name, client_id, ig_business_id, picture_url, is_active')
        .in('tenant_id', accessibleTenantIds).eq('is_active', true).order('page_name')
      if (args.platform) q = q.eq('platform', args.platform)
      if (args.client_id) q = q.eq('client_id', args.client_id)
      const { data, error } = await q
      if (error) return { error: error.message }
      return { count: data?.length || 0, pages: data || [] }
    }
    case 'sync_social_pages': {
      const targetTenantId = accessibleTenantIds[0]
      const r = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/social-pages-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` },
        body: JSON.stringify({ tenant_id: targetTenantId, client_id: args.client_id }),
      })
      return await r.json()
    }
    case 'publish_social_post': {
      await assertCallerCanAccessEntityClient(supabase, 'social_pages', args.page_id, callerScope)
      if (args.confirmed !== true) return { error: 'not_confirmed', message: 'אישור משתמש מפורש נדרש (confirmed=true)' }
      const targetTenantId = accessibleTenantIds[0]
      const r = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/social-publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` },
        body: JSON.stringify({ tenant_id: targetTenantId, page_id: args.page_id, post_type: args.post_type, caption: args.caption, media_url: args.media_url, link: args.link }),
      })
      return await r.json()
    }
    case 'fetch_social_comments': {
      const targetTenantId = accessibleTenantIds[0]
      const r = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/social-comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` },
        body: JSON.stringify({ action: 'fetch', tenant_id: targetTenantId, page_id: args.page_id }),
      })
      return await r.json()
    }
    case 'list_social_comments': {
      let q = supabase.from('social_comments')
        .select('id, platform, author_name, message, external_post_id, replied_at, hidden_at, created_at_external, page_id, client_id')
        .in('tenant_id', accessibleTenantIds)
        .eq('is_from_page', false)
        .order('created_at_external', { ascending: false, nullsFirst: false })
        .limit(100)
      if (args.page_id) q = q.eq('page_id', args.page_id)
      if (args.client_id) q = q.eq('client_id', args.client_id)
      if (args.only_unreplied !== false) q = q.is('replied_at', null).is('hidden_at', null)
      const { data, error } = await q
      if (error) return { error: error.message }
      return { count: data?.length || 0, comments: data || [] }
    }
    case 'reply_to_social_comment':
    case 'hide_social_comment': {
      await assertCallerCanAccessEntityClient(supabase, 'social_comments', args.comment_row_id, callerScope)
      if (args.confirmed !== true) return { error: 'not_confirmed', message: 'אישור משתמש מפורש נדרש' }
      const targetTenantId = accessibleTenantIds[0]
      const action = name === 'reply_to_social_comment' ? 'reply' : 'hide'
      const r = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/social-comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` },
        body: JSON.stringify({ action, tenant_id: targetTenantId, comment_row_id: args.comment_row_id, message: args.message }),
      })
      return await r.json()
    }
    case 'get_latest_campaign_pulse': {
      const loadPulse = async () => {
        let query = supabase
          .from('campaign_pulse_snapshots')
          .select('calculated_at, data_fresh_through, status, is_ecommerce, spend_7d, leads_7d, cpl_7d, cpl_change_pct, purchases_7d, revenue_7d, roas_7d, flags, source, client_id, agency_id, clients(name), agencies(name)')
          .eq('tenant_id', tenantId)
          .order('calculated_at', { ascending: false })
        if (args.client_id) query = query.eq('client_id', args.client_id)
        if (args.agency_id) query = query.eq('agency_id', args.agency_id)
        if (args.status) query = query.eq('status', args.status)
        if (callerManagedAgencyIds && callerManagedAgencyIds.length > 0) {
          query = query.in('agency_id', callerManagedAgencyIds)
        }
        return await query
      }
      let { data, error } = await loadPulse()
      if (error) throw error
      let autoRefreshed = false
      if (!data?.length) {
        const refresh = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/campaign-pulse-snapshot`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          },
          body: JSON.stringify({ tenant_id: tenantId, deliver: false, source: 'carmen_cache_refresh' }),
        })
        if (refresh.ok) {
          autoRefreshed = true
          const reloaded = await loadPulse()
          data = reloaded.data
          error = reloaded.error
          if (error) throw error
        }
      }
      let rows = data || []
      if (args.client_name) {
        const needle = String(args.client_name).toLocaleLowerCase('he')
        rows = rows.filter((row: any) => String(row.clients?.name || '').toLocaleLowerCase('he').includes(needle))
      }
      if (args.agency_name) {
        const needle = String(args.agency_name).toLocaleLowerCase('he')
        rows = rows.filter((row: any) => String(row.agencies?.name || '').toLocaleLowerCase('he').includes(needle))
      }
      return {
        data_source: 'deterministic_campaign_pulse_cache',
        external_api_called: false,
        ai_used_to_calculate: false,
        auto_refreshed: autoRefreshed,
        count: rows.length,
        freshness: rows[0]?.calculated_at || null,
        rows: rows.map((row: any) => ({
          ...row,
          client_name: row.clients?.name || null,
          agency_name: row.agencies?.name || null,
          clients: undefined,
          agencies: undefined,
        })),
        instructions_to_agent: rows.length
          ? 'הציגי את הנתונים בטבלה מסודרת המקובצת לפי סוכנות וצייני מתי חושבו. אל תריצי כלי חי נוסף אלא אם המשתמש ביקש במפורש נתונים חיים/רענון או ניתוח עמוק.'
          : 'מנוע הדופק הופעל אוטומטית אך לא החזיר snapshot. אמרי שלא נמצאו נתונים מחושבים; אל תטעני שאין קמפיינים.',
      }
    }
    case 'analyze_campaign_performance': {
      // 1. Resolve scope -> list of target clients (active+onboarding)
      let agencyIdsFilter: string[] | null = null
      let agencyNameLabel: string | null = null
      if (args.agency_id) {
        agencyIdsFilter = [args.agency_id]
      } else if (args.agency_name) {
        const { data: ags } = await supabase
          .from('agencies').select('id, name')
          .in('tenant_id', accessibleTenantIds)
          .ilike('name', `%${args.agency_name}%`)
        agencyIdsFilter = (ags || []).map((a: any) => a.id)
        agencyNameLabel = (ags || []).map((a: any) => a.name).join(', ') || args.agency_name
        if (agencyIdsFilter.length === 0) {
          return { scope: { agency_name: args.agency_name }, coverage_summary: { synced: 0, not_connected: 0 }, synced_clients: [], not_connected_clients: [], note: `no agency matched "${args.agency_name}"` }
        }
      }

      // Own tenant's clients + shared-tenant clients ONLY within agencies shared via
      // agency_tenant_access. A tenant-wide scope here floods the report with the
      // partner tenant's entire client base and scrambles the per-agency grouping.
      const perfSel = 'id, name, agency_id, is_ecommerce, agencies(name)'
      const perfFilters = (q: any) => {
        q = q.in('status', ['active'])  // pulse/health reports must exclude paused/ended/onboarding clients
        if (args.client_id) q = q.eq('id', args.client_id)
        if (agencyIdsFilter) q = q.in('agency_id', agencyIdsFilter)
        return q
      }
      const { data: perfOwn, error: clientsErr } = await perfFilters(
        supabase.from('clients').select(perfSel).eq('tenant_id', tenantId)).order('name')
      if (clientsErr) throw clientsErr
      let targetClients: any[] = perfOwn || []
      const { data: perfShares } = await supabase.from('agency_tenant_access')
        .select('source_tenant_id, agency_id').eq('accessing_tenant_id', tenantId)
      // Reports pull cross-tenant clients only for agencies the reporting tenant
      // OWNS (its own agency's clients parked in a partner tenant) — not the
      // partner's agencies, whose clients belong in the partner's own report.
      const perfShareAgencyIds = [...new Set((perfShares || []).map((s: any) => s.agency_id).filter(Boolean))]
      const perfOwnedAgencies = new Set<string>()
      if (perfShareAgencyIds.length > 0) {
        const { data: ags } = await supabase.from('agencies')
          .select('id').eq('tenant_id', tenantId).in('id', perfShareAgencyIds)
        for (const a of (ags || [])) perfOwnedAgencies.add(a.id)
      }
      for (const sh of (perfShares || [])) {
        if (!sh.source_tenant_id || sh.source_tenant_id === tenantId || !sh.agency_id) continue
        if (!perfOwnedAgencies.has(sh.agency_id)) continue
        const { data: sharedClients } = await perfFilters(
          supabase.from('clients').select(perfSel).eq('tenant_id', sh.source_tenant_id).eq('agency_id', sh.agency_id))
        if (sharedClients?.length) targetClients = targetClients.concat(sharedClients)
      }

      const clientIds = (targetClients || []).map((c: any) => c.id)
      if (clientIds.length === 0) {
        return { scope: { agency_name: agencyNameLabel, total_active_clients: 0 }, coverage_summary: { synced: 0, not_connected: 0 }, synced_clients: [], not_connected_clients: [] }
      }

      // 2. Find campaign tables by SCHEMA (spend + campaign_name/id), not by slug
      const { data: campaignTables, error: rpcErr } = await supabase
        .rpc('find_campaign_tables', { p_client_ids: clientIds })
      if (rpcErr) throw rpcErr

      const tablesByClient = new Map<string, any[]>()
      for (const t of (campaignTables || [])) {
        const arr = tablesByClient.get(t.client_id) || []
        arr.push(t)
        tablesByClient.set(t.client_id, arr)
      }

      // 3. Compute metrics for each client that has tables
      const now = new Date()
      const d7 = new Date(now); d7.setDate(d7.getDate() - 7)
      const d30 = new Date(now); d30.setDate(d30.getDate() - 30)
      const d7Str = d7.toISOString().split('T')[0]
      const d30Str = d30.toISOString().split('T')[0]

      const synced_clients: any[] = []
      const not_connected_clients: any[] = []

      for (const client of (targetClients || [])) {
        const tables = tablesByClient.get(client.id) || []
        if (tables.length === 0) {
          not_connected_clients.push({ client_id: client.id, client_name: client.name, reason: 'no_campaign_table' })
          continue
        }

        const tableIds = tables.map((t: any) => t.table_id)
        const { data: records } = await supabase
          .from('crm_records').select('data')
          .in('table_id', tableIds)
          .in('tenant_id', accessibleTenantIds)

        if (!records || records.length === 0) {
          not_connected_clients.push({ client_id: client.id, client_name: client.name, reason: 'empty_table' })
          continue
        }

        const last30d = records.filter((r: any) => r.data?.date && r.data.date >= d30Str)
        if (last30d.length === 0) {
          not_connected_clients.push({ client_id: client.id, client_name: client.name, reason: 'no_recent_data_30d' })
          continue
        }

        const last7d = last30d.filter((r: any) => r.data?.date >= d7Str)
        const older = last30d.filter((r: any) => r.data?.date < d7Str)

        const sum = (arr: any[], field: string) => arr.reduce((s: number, r: any) => s + (parseFloat(r.data?.[field]) || 0), 0)
        const spend7 = sum(last7d, 'spend')
        const spendOlder = sum(older, 'spend')
        const leads7 = sum(last7d, 'leads')
        const leadsOlder = sum(older, 'leads')

        const days7 = Math.max(last7d.length, 1)
        const daysOlder = Math.max(older.length, 1)
        const dailySpend7 = spend7 / days7
        const dailySpendOlder = spendOlder / daysOlder
        const spendChangePct = dailySpendOlder > 0 ? ((dailySpend7 - dailySpendOlder) / dailySpendOlder * 100) : null

        const cpl7 = leads7 > 0 ? spend7 / leads7 : null
        const cplOlder = leadsOlder > 0 ? spendOlder / leadsOlder : null
        const cplChangePct = cplOlder && cpl7 ? ((cpl7 - cplOlder) / cplOlder * 100) : null

        // Ecommerce metrics (purchases / purchase_value / roas)
        const purchases7 = sum(last7d, 'purchases')
        const purchasesOlder = sum(older, 'purchases')
        const purchaseValue7 = sum(last7d, 'purchase_value')
        const purchaseValueOlder = sum(older, 'purchase_value')
        const cpp7 = purchases7 > 0 ? spend7 / purchases7 : null
        const cppOlder = purchasesOlder > 0 ? spendOlder / purchasesOlder : null
        const cppChangePct = cppOlder && cpp7 ? ((cpp7 - cppOlder) / cppOlder * 100) : null
        const roas7 = spend7 > 0 ? purchaseValue7 / spend7 : null
        const profit7 = purchaseValue7 - spend7

        const updatedTimes = last30d.map((r: any) => r.data?.updated_time).filter((t: any) => t).sort().reverse()
        const lastCampaignUpdate = updatedTimes[0] || null
        const daysSinceLastCampaignTouch = lastCampaignUpdate
          ? Math.floor((now.getTime() - new Date(lastCampaignUpdate).getTime()) / (1000 * 60 * 60 * 24))
          : null

        const lastDataDate = last30d.map((r: any) => r.data?.date).filter(Boolean).sort().reverse()[0] || null

        const isEcom = !!client.is_ecommerce
        const ecomAlert = isEcom
          ? (roas7 !== null && roas7 < 1 ? '🔴 ROAS<1 הפסד'
            : purchases7 === 0 && spend7 > 0 ? '🔴 אין רכישות'
            : roas7 !== null && roas7 < 1.5 ? '🟠 ROAS נמוך'
            : (cppChangePct !== null && cppChangePct > 25) ? '🟠 CPP עלה'
            : '🟢 תקין')
          : null

        synced_clients.push({
          client_id: client.id,
          client_name: client.name,
          agency_name: client.agencies?.name ?? null,
          is_ecommerce: isEcom,
          spend_7d: Math.round(spend7 * 100) / 100,
          spend_30d: Math.round((spend7 + spendOlder) * 100) / 100,
          leads_7d: leads7,
          leads_30d: leads7 + leadsOlder,
          cpl_7d: cpl7 ? Math.round(cpl7 * 100) / 100 : null,
          cpl_30d_avg: cplOlder ? Math.round(cplOlder * 100) / 100 : null,
          // Ecommerce metrics — present for all clients but the skill only uses them when is_ecommerce=true
          purchases_7d: purchases7,
          purchases_30d: purchases7 + purchasesOlder,
          revenue_7d: Math.round(purchaseValue7 * 100) / 100,
          revenue_30d: Math.round((purchaseValue7 + purchaseValueOlder) * 100) / 100,
          cpp_7d: cpp7 ? Math.round(cpp7 * 100) / 100 : null,
          cpp_change_pct: cppChangePct !== null ? Math.round(cppChangePct * 10) / 10 : null,
          roas_7d: roas7 !== null ? Math.round(roas7 * 100) / 100 : null,
          profit_7d: Math.round(profit7 * 100) / 100,
          spend_change_pct: spendChangePct !== null ? Math.round(spendChangePct * 10) / 10 : null,
          cpl_change_pct: cplChangePct !== null ? Math.round(cplChangePct * 10) / 10 : null,
          last_data_date: lastDataDate,
          last_campaign_update: lastCampaignUpdate,
          days_since_last_campaign_touch: daysSinceLastCampaignTouch,
          alert: isEcom ? ecomAlert : (spendChangePct !== null && spendChangePct > 15 ? '🔴 התייקרות' : (cplChangePct !== null && cplChangePct > 20 ? '🟡 עלייה בעלות לליד' : '🟢 תקין')),
        })
      }


      synced_clients.sort((a: any, b: any) => (b.spend_change_pct || 0) - (a.spend_change_pct || 0))

      // Try-to-connect pass: for every client we couldn't report from synced data,
      // attempt a LIVE pull straight from Meta. Connects mapped-but-stale clients via
      // their config and truly-unmapped clients via a strong name match — so "not
      // connected" becomes real live numbers wherever possible, and whatever still
      // can't connect is surfaced explicitly (never silently dropped, never faked).
      const { connected: newly_connected_clients, stillNotConnected: still_not_connected_clients } =
        not_connected_clients.length > 0
          ? await fbTryConnectClients(supabase, accessibleTenantIds[0], not_connected_clients, 7)
          : { connected: [], stillNotConnected: [] }

      const hasNameMatch = newly_connected_clients.some((c: any) => c.matched_by === 'name')

      return {
        scope: {
          agency_name: agencyNameLabel,
          agency_ids: agencyIdsFilter,
          client_id: args.client_id || null,
          total_active_clients: targetClients?.length || 0,
        },
        coverage_summary: {
          synced: synced_clients.length,
          connected_live: newly_connected_clients.length,
          still_not_connected: still_not_connected_clients.length,
        },
        // Portfolio trend scan runs off the synced CRM tables (needs the daily history for the
        // 7d-vs-prior comparison). For live, up-to-the-minute status/leads on a single client use
        // get_facebook_campaign_data / list_facebook_campaigns (source: 'live_meta'). Per-client
        // `last_data_date` shows how fresh each row is.
        data_source: 'synced_crm+live_meta',
        synced_clients,
        // Clients that had no synced data but we connected LIVE this run (7d window).
        // matched_by:'name' means auto-matched by name — needs human verification.
        newly_connected_clients,
        // Clients we still couldn't connect — these need manual linking; tell the user.
        still_not_connected_clients,
        instructions_to_agent:
          'דווחי על שלושת הסלוטים: synced_clients (היסטורי), newly_connected_clients (משכתי חי עכשיו) ו-still_not_connected_clients. ' +
          'אסור לטעון "אין נתונים" כשיש נתונים. עבור newly_connected_clients הציגי את המספרים החיים (spend/leads/CPL ל-7 ימים). ' +
          (hasNameMatch
            ? 'חלק מהלקוחות חוברו לפי התאמת שם (matched_by="name") — ציַני זאת במפורש לדויד ובקשי אישור שהחשבון נכון לפני שמסתמכים על המספרים. '
            : '') +
          (still_not_connected_clients.length > 0
            ? 'עבור still_not_connected_clients — נסיתי לחבר אוטומטית ולא הצלחתי; אמרי לדויד במפורש אילו לקוחות לא הצלחתי לחבר ומה הסיבה (connect_attempt), והציעי חיבור ידני. אל תמציאי מספרים עבורם.'
            : 'כל הלקוחות חוברו (מסונכרן או חי).'),
      }
    }
    case 'update_client_health': {
      await assertCallerCanAccessClient(supabase, args.client_id, callerScope)
      // Resolve an actor user for audit/update visibility even in background "system" runs
      let effectiveUserId = userId !== 'system' ? userId : null
      if (!effectiveUserId) {
        const { data: ownerRole } = await supabase
          .from('user_roles')
          .select('user_id')
          .in('tenant_id', accessibleTenantIds)
          .eq('role', 'owner')
          .limit(1)
          .maybeSingle()

        effectiveUserId = ownerRole?.user_id || null
      }

      // 1. Update mood_status on client
      const updateData: any = { mood_status: args.mood_status }
      const { error: clientErr } = await supabase
        .from('clients')
        .update(updateData)
        .eq('id', args.client_id)
        .in('tenant_id', accessibleTenantIds)
      if (clientErr) throw clientErr

      // 2. Create communication_log entry
      const commStatus = args.communication_status || (args.mood_status === 'happy' ? 'normal' : args.mood_status === 'wavering' ? 'sensitive' : 'complaint')
      const { error: logErr } = await supabase
        .from('communication_logs')
        .insert({
          client_id: args.client_id,
          tenant_id: tenantId,
          status: commStatus,
          interaction_type: 'system_alert',
          note: args.note,
          updated_by: effectiveUserId,
        })
      if (logErr) throw logErr

      // 3. Also create a client_update so it's visible in the client updates tab
      if (effectiveUserId) {
        const { error: clientUpdateErr } = await supabase
          .from('client_updates')
          .insert({
            client_id: args.client_id,
            tenant_id: tenantId,
            user_id: effectiveUserId,
            content: `[עדכון אוטומטי - כרמן] ${args.note}`,
          })

        if (clientUpdateErr) throw clientUpdateErr
      }

      return { success: true, client_id: args.client_id, mood_status: args.mood_status, communication_status: commStatus, user_id: effectiveUserId }
    }
    case 'create_social_post': {
      // Insert into both social_media_posts (for publishing) and social_gantt_posts (for planning view)
      const postData = {
        tenant_id: tenantId,
        title: args.title,
        content: args.content,
        post_type: args.post_type || 'image',
        media_urls: args.media_urls || [],
        status: 'draft',
        created_by: userId !== 'system' ? userId : null,
      }
      const { data, error } = await supabase.from('social_media_posts').insert(postData).select('id, title, content, post_type, media_urls, status').single()
      if (error) throw error
      // Also create in gantt for visibility in the content calendar
      const today = new Date().toISOString().split('T')[0]
      try {
        await supabase.from('social_gantt_posts').insert({
          tenant_id: tenantId,
          topic: args.title,
          copy_text: args.content,
          platform: 'facebook',
          status: 'draft',
          scheduled_date: today,
          creative_url: args.media_urls?.[0] || null,
        })
      } catch (_e) { /* non-critical */ }
      return { success: true, post_id: data.id, title: data.title, content: data.content, media_urls: data.media_urls, status: 'draft', message: 'הפוסט נוצר בהצלחה כטיוטה במודול סושיאל מדיה' }
    }
    case 'generate_ad_image': {
      const imagePrompt = args.prompt

      const openaiKey = await resolveOpenAIKey()
      if (!openaiKey) {
        return { error: 'מפתח OpenAI לא מוגדר. יש להגדיר OPENAI_API_KEY בסודות Supabase, או להוסיף מפתח OpenAI בהגדרות האינטגרציות (LLM).', suggestion: 'פנה למנהל המערכת להגדרת המפתח.' }
      }

      const imageRes = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-image-1',
          prompt: `${imagePrompt}. Professional, high quality, suitable for a social media advertisement.`,
          n: 1,
          size: '1024x1024',
          output_format: 'png',
        }),
      })
      
      if (!imageRes.ok) {
        const errText = await imageRes.text()
        throw new Error(`Image generation error: ${errText}`)
      }
      
      const imageData = await imageRes.json()
      const content = imageData.choices?.[0]?.message?.content || ''
      
      // OpenAI Images API returns base64 PNG; adapt to the downstream extractor.
      const b64 = imageData?.data?.[0]?.b64_json || ''
      const images = b64 ? [{ image_url: { url: `data:image/png;base64,${b64}` } }] : []
      let imageUrl = ''
      
      if (images.length > 0 && images[0]?.image_url?.url) {
        const dataUrl = images[0].image_url.url
        // Extract base64 data from data URL
        const base64Match = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/)
        if (base64Match) {
          const mimeType = `image/${base64Match[1]}`
          const base64 = base64Match[2]
          const ext = base64Match[1] === 'jpeg' ? 'jpg' : base64Match[1]
          const fileName = `agent-generated/${tenantId}/${crypto.randomUUID()}.${ext}`
          
          const binaryData = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
          
          // Ensure bucket exists
          await supabase.storage.createBucket('social-media', { public: true }).catch(() => {})
          
          const { error: uploadError } = await supabase.storage
            .from('social-media')
            .upload(fileName, binaryData, { contentType: mimeType, upsert: true })
          
          if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`)
          
          const { data: urlData } = supabase.storage.from('social-media').getPublicUrl(fileName)
          imageUrl = urlData.publicUrl
        }
      }
      
      // Fallback: check inline_data in parts
      if (!imageUrl) {
        const parts = imageData.choices?.[0]?.message?.parts || []
        for (const part of parts) {
          if (part.inline_data) {
            const base64 = part.inline_data.data
            const mimeType = part.inline_data.mime_type || 'image/png'
            const ext = mimeType.includes('jpeg') ? 'jpg' : 'png'
            const fileName = `agent-generated/${tenantId}/${crypto.randomUUID()}.${ext}`
            const binaryData = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
            await supabase.storage.createBucket('social-media', { public: true }).catch(() => {})
            const { error: uploadError } = await supabase.storage
              .from('social-media')
              .upload(fileName, binaryData, { contentType: mimeType, upsert: true })
            if (uploadError) throw uploadError
            const { data: urlData } = supabase.storage.from('social-media').getPublicUrl(fileName)
            imageUrl = urlData.publicUrl
            break
          }
        }
      }
      
      if (!imageUrl) {
        return { success: false, error: 'לא הצלחתי ליצור תמונה. נסה שוב עם תיאור אחר.', raw_content: content }
      }
      
      return { success: true, image_url: imageUrl, message: 'התמונה נוצרה בהצלחה. השתמש בה ביצירת הפוסט.' }
    }
    // CLIENTS - full CRUD
    case 'create_client': {
      const { data: defaultAgency } = await supabase.from('agencies').select('id').in('tenant_id', accessibleTenantIds).limit(1).single()
      const { data, error } = await supabase.from('clients').insert({
        name: args.name, contact_name: args.contact_name || null, phone: args.phone || null,
        email: args.email || null, notes: args.notes || null, tenant_id: tenantId,
        agency_id: args.agency_id || defaultAgency?.id, status: 'active',
      }).select('id, name, status').single()
      if (error) throw error
      return { client_id: data.id, name: data.name, status: data.status }
    }
    case 'update_client': {
      await assertCallerCanAccessClient(supabase, args.client_id, callerScope)
      const updates: Record<string, any> = {}
      if (args.name) updates.name = args.name
      if (args.contact_name !== undefined) updates.contact_name = args.contact_name
      if (args.phone !== undefined) updates.phone = args.phone
      if (args.email !== undefined) updates.email = args.email
      if (args.status) updates.status = args.status
      if (args.notes !== undefined) updates.notes = args.notes
      const { data, error } = await supabase.from('clients').update(updates).eq('id', args.client_id).in('tenant_id', accessibleTenantIds).select('id, name, status').single()
      if (error) throw error
      return data
    }
    case 'update_client_status': {
      await assertCallerCanAccessClient(supabase, args.client_id, callerScope)
      const { data, error } = await supabase.from('clients').update({ status: args.status }).eq('id', args.client_id).in('tenant_id', accessibleTenantIds).select('id, name, status').single()
      if (error) throw error
      return data
    }
    case 'set_campaign_table_active': {
      if (!args.table_id && !args.client_id && !args.table_name) throw new Error('נדרש client_id, table_id או table_name')
      if (args.client_id) await assertCallerCanAccessClient(supabase, args.client_id, callerScope)
      let q = supabase.from('crm_tables').update({ campaign_active: !!args.active }).in('tenant_id', accessibleTenantIds)
      if (args.table_id) q = q.eq('id', args.table_id)
      if (args.client_id) q = q.eq('client_id', args.client_id)
      if (args.table_name) q = q.or(`name.ilike.%${String(args.table_name).replace(/[%,]/g, '')}%,slug.ilike.%${String(args.table_name).replace(/[%,]/g, '')}%`)
      const { data, error } = await q.select('id, name, client_id, campaign_active')
      if (error) throw error
      if (!data?.length) throw new Error('לא נמצאה טבלת קמפיין תואמת')
      return { updated: data.length, campaign_active: !!args.active, tables: data.map((t: any) => t.name) }
    }
    // LEADS - full CRUD
    case 'update_lead': {
      const updates: Record<string, any> = {}
      if (args.company_name) updates.company_name = args.company_name
      if (args.contact_name !== undefined) updates.contact_name = args.contact_name
      if (args.phone !== undefined) updates.phone = args.phone
      if (args.email !== undefined) updates.email = args.email
      if (args.source !== undefined) updates.source = args.source
      if (args.notes !== undefined) updates.notes = args.notes
      if (args.follow_up_date !== undefined) updates.follow_up_date = args.follow_up_date
      const { data, error } = await supabase.from('leads').update(updates).eq('id', args.lead_id).in('tenant_id', accessibleTenantIds).select('id, company_name, status').single()
      if (error) throw error
      return data
    }
    case 'delete_lead': {
      const { error } = await supabase.from('leads').delete().eq('id', args.lead_id).in('tenant_id', accessibleTenantIds)
      if (error) throw error
      return { success: true, deleted_id: args.lead_id }
    }
    // TASKS - full CRUD
    case 'update_task': {
      await assertCallerCanAccessEntityClient(supabase, 'tasks', args.task_id, callerScope)
      const updates: Record<string, any> = {}
      if (args.title) updates.title = args.title
      if (args.due_date !== undefined) updates.due_date = args.due_date
      if (args.due_time !== undefined) updates.due_time = args.due_time
      if (args.priority !== undefined) updates.priority = args.priority
      if (args.notes !== undefined) updates.notes = args.notes
      if (args.client_id !== undefined) updates.client_id = args.client_id
      if (args.lead_id !== undefined) updates.lead_id = args.lead_id
      if (args.campaigner_id !== undefined) updates.campaigner_id = args.campaigner_id
      if (args.duration_minutes !== undefined) updates.duration_minutes = args.duration_minutes
      if (args.status) updates.status = args.status
      const { data, error } = await supabase.from('tasks').update(updates).eq('id', args.task_id).in('tenant_id', accessibleTenantIds).select('id, title, status').single()
      if (error) throw error
      return data
    }
    case 'delete_task': {
      await assertCallerCanAccessEntityClient(supabase, 'tasks', args.task_id, callerScope)
      const { error } = await supabase.from('tasks').delete().eq('id', args.task_id).in('tenant_id', accessibleTenantIds)
      if (error) throw error
      return { success: true, deleted_id: args.task_id }
    }
    case 'add_task_update': {
      await assertCallerCanAccessEntityClient(supabase, 'tasks', args.task_id, callerScope)
      const { data, error } = await supabase.from('task_updates').insert({ task_id: args.task_id, user_id: userId, tenant_id: tenantId, content: args.content }).select('id').single()
      if (error) throw error
      return { update_id: data.id }
    }
    case 'manage_task_collaborators': {
      if (args.action === 'add') {
        const { data, error } = await supabase.from('task_collaborators').insert({
          task_id: args.task_id, campaigner_id: args.campaigner_id, tenant_id: tenantId,
        }).select('id').single()
        if (error) throw error
        return { success: true, action: 'added', collaborator_id: data.id }
      } else {
        const { error } = await supabase.from('task_collaborators').delete()
          .eq('task_id', args.task_id).eq('campaigner_id', args.campaigner_id).in('tenant_id', accessibleTenantIds)
        if (error) throw error
        return { success: true, action: 'removed' }
      }
    }
    // CLIENT ONBOARDING
    case 'create_onboarding': {
      const { data, error } = await supabase.from('client_onboarding').insert({
        title: args.title, client_id: args.client_id, campaigner_id: args.campaigner_id || null,
        notes: args.notes || null, tenant_id: tenantId, status: 'pending',
      }).select('id, title, status').single()
      if (error) throw error
      return { onboarding_id: data.id, title: data.title, status: data.status }
    }
    case 'list_onboarding': {
      let query = supabase.from('client_onboarding').select('id, title, status, clients(name)').in('tenant_id', accessibleTenantIds).order('created_at', { ascending: false }).limit(args.limit || 20)
      if (args.status) query = query.eq('status', args.status)
      const { data, error } = await query
      if (error) throw error
      return { count: data.length, onboarding: data.map((o: any) => ({ ...o, client_name: o.clients?.name })) }
    }
    case 'update_onboarding_status': {
      const { data, error } = await supabase.from('client_onboarding').update({ status: args.status }).eq('id', args.onboarding_id).in('tenant_id', accessibleTenantIds).select('id, title, status').single()
      if (error) throw error
      return data
    }
    // CAMPAIGNERS
    case 'list_campaigners': {
      const { data, error } = await supabase.from('campaigners').select('id, full_name, phone, email, role').in('tenant_id', accessibleTenantIds).order('full_name').limit(args.limit || 50)
      if (error) throw error
      return { count: data.length, campaigners: data }
    }
    case 'create_campaigner': {
      const { data, error } = await supabase.from('campaigners').insert({
        full_name: args.full_name, phone: args.phone || null, email: args.email || null,
        role: args.role || null, tenant_id: tenantId,
      }).select('id, full_name').single()
      if (error) throw error
      return { campaigner_id: data.id, full_name: data.full_name }
    }
    // SALES PEOPLE
    case 'list_sales_people': {
      const { data, error } = await supabase.from('sales_people').select('id, full_name, phone, email').in('tenant_id', accessibleTenantIds).order('full_name').limit(args.limit || 50)
      if (error) throw error
      return { count: data.length, sales_people: data }
    }
    case 'create_sales_person': {
      const { data, error } = await supabase.from('sales_people').insert({
        full_name: args.full_name, phone: args.phone || null, email: args.email || null, tenant_id: tenantId,
      }).select('id, full_name').single()
      if (error) throw error
      return { sales_person_id: data.id, full_name: data.full_name }
    }
    // AGENCIES
    case 'list_agencies': {
      const { data, error } = await supabase.from('agencies').select('id, name, contact_name, phone, email').in('tenant_id', accessibleTenantIds).order('name').limit(args.limit || 50)
      if (error) throw error
      return { count: data.length, agencies: data }
    }
    case 'create_agency': {
      const { data, error } = await supabase.from('agencies').insert({
        name: args.name, contact_name: args.contact_name || null, phone: args.phone || null,
        email: args.email || null, tenant_id: tenantId,
      }).select('id, name').single()
      if (error) throw error
      return { agency_id: data.id, name: data.name }
    }
    // SUPPLIERS
    case 'list_suppliers': {
      const { data, error } = await supabase.from('suppliers').select('id, name, type, phone, email').in('tenant_id', accessibleTenantIds).order('name').limit(args.limit || 50)
      if (error) throw error
      return { count: data.length, suppliers: data }
    }
    case 'create_supplier': {
      const { data, error } = await supabase.from('suppliers').insert({
        name: args.name, type: args.type || 'other', phone: args.phone || null,
        email: args.email || null, tenant_id: tenantId,
      }).select('id, name').single()
      if (error) throw error
      return { supplier_id: data.id, name: data.name }
    }
    // PRODUCTS
    case 'list_products': {
      const { data, error } = await supabase.from('products').select('id, name, description, price, active').in('tenant_id', accessibleTenantIds).order('name').limit(args.limit || 50)
      if (error) throw error
      return { count: data.length, products: data }
    }
    case 'create_product': {
      const { data, error } = await supabase.from('products').insert({
        name: args.name, description: args.description || null, price: args.price, active: true, tenant_id: tenantId,
      }).select('id, name, price').single()
      if (error) throw error
      return { product_id: data.id, name: data.name, price: data.price }
    }
    // AUTOMATIONS
    case 'list_automations': {
      const { data, error } = await supabase.from('automations').select('id, name, active, trigger_type').in('tenant_id', accessibleTenantIds).order('name').limit(args.limit || 50)
      if (error) throw error
      return { count: data.length, automations: data }
    }
    case 'toggle_automation': {
      const { data, error } = await supabase.from('automations').update({ active: args.active }).eq('id', args.automation_id).in('tenant_id', accessibleTenantIds).select('id, name, active').single()
      if (error) throw error
      return { automation_id: data.id, name: data.name, active: data.active }
    }
    // DASHBOARD STATS
    case 'get_dashboard_stats': {
      const [leadsRes, clientsRes, tasksRes, onboardingRes] = await Promise.all([
        supabase.from('leads').select('status', { count: 'exact', head: false }).in('tenant_id', accessibleTenantIds),
        supabase.from('clients').select('status', { count: 'exact', head: false }).in('tenant_id', accessibleTenantIds),
        supabase.from('tasks').select('status', { count: 'exact', head: false }).in('tenant_id', accessibleTenantIds).eq('status', 'open'),
        supabase.from('client_onboarding').select('status', { count: 'exact', head: false }).in('tenant_id', accessibleTenantIds).eq('status', 'in_progress'),
      ])
      const leadsByStatus = (leadsRes.data || []).reduce((acc: any, l: any) => { acc[l.status] = (acc[l.status] || 0) + 1; return acc }, {})
      const clientsByStatus = (clientsRes.data || []).reduce((acc: any, c: any) => { acc[c.status] = (acc[c.status] || 0) + 1; return acc }, {})
      return {
        leads: { total: leadsRes.data?.length || 0, by_status: leadsByStatus },
        clients: { total: clientsRes.data?.length || 0, by_status: clientsByStatus },
        open_tasks: tasksRes.data?.length || 0,
        active_onboarding: onboardingRes.data?.length || 0,
      }
    }
    // MEMORY
    case 'save_memory': {
      const cat = args.category || 'general'
      const { data, error } = await supabase.from('ai_memory').upsert({
        tenant_id: tenantId, user_id: (userId && userId !== 'system') ? userId : null, key: args.key, content: args.content, category: cat,
      }, { onConflict: 'user_id,tenant_id,category,key', ignoreDuplicates: false }).select('key, category').single()
      if (error) throw error
      // Mirror to agent_memory (Hermes FTS layer) for cross-conversation recall
      const importanceMap: Record<string, number> = {
        instructions: 95, preferences: 85, personal: 80, projects: 70, clients: 70, workflows: 65, general: 50,
      }
      saveAgentMemory({
        supabase, tenant_id: tenantId, agent_id,
        category: cat,
        title: args.key,
        summary: args.content,
        importance: importanceMap[cat] ?? 60,
        metadata: { source: 'save_memory', key: args.key, user_id: userId || 'system' },
      }).catch(() => {})
      return { saved: true, key: data.key, category: data.category }
    }
    case 'recall_memory': {
      let query = supabase.from('ai_memory').select('key, content, category, updated_at').in('tenant_id', accessibleTenantIds)
      if (args.category) query = query.eq('category', args.category)
      if (args.search) query = query.ilike('content', `%${args.search}%`)
      const { data, error } = await query.order('updated_at', { ascending: false }).limit(20)
      if (error) throw error
      return { count: data.length, memories: data }
    }
    case 'recall_memory_fts': {
      // Hermes-style FTS recall across agent_memory (cross-session, importance-aware)
      const items = await recallAgentMemoryFTS(supabase, {
        tenant_id: tenantId,
        agent_id,
        query_text: args.query || '',
        limit: args.limit || 5,
        min_importance: args.min_importance || 0,
      })
      return { count: items.length, memories: items }
    }
    case 'delete_memory': {
      const { error } = await supabase.from('ai_memory').delete().in('tenant_id', accessibleTenantIds).eq('key', args.key)
      if (error) throw error
      return { deleted: true, key: args.key }
    }
    // KNOWLEDGE BASE
    case 'kb_list_folder': {
      let q = supabase.from('carmen_memory_pointers')
        .select('id, category, subcategory, path, entity_type, entity_id, title, summary, ref_date, importance')
        .in('tenant_id', accessibleTenantIds)
      if (args.category) q = q.eq('category', args.category)
      if (args.subcategory) q = q.eq('subcategory', args.subcategory)
      if (args.path_prefix) q = q.like('path', `${args.path_prefix}%`)
      const { data, error } = await q.order('ref_date', { ascending: false, nullsFirst: false }).limit(args.limit || 50)
      if (error) throw error
      return { count: data.length, pointers: data }
    }
    case 'kb_search': {
      // Try semantic via embedding; fall back to text ILIKE on title/summary
      try {
        const vec = await aiEmbed(args.query)
        if (vec) {
          const { data, error } = await supabase.rpc('kb_match_pointers', {
            p_tenant_id: tenantId,
            p_query_embedding: vec,
            p_category: args.category || null,
            p_since_days: args.since_days || null,
            p_limit: args.limit || 20,
          })
          if (!error && data) return { count: data.length, results: data, mode: 'semantic' }
        }
      } catch (_) {/* fall through */}
      // Fallback text search
      let q = supabase.from('carmen_memory_pointers')
        .select('id, category, subcategory, path, entity_type, entity_id, title, summary, ref_date')
        .in('tenant_id', accessibleTenantIds)
        .or(`title.ilike.%${args.query}%,summary.ilike.%${args.query}%`)
      if (args.category) q = q.eq('category', args.category)
      if (args.since_days) q = q.gte('ref_date', new Date(Date.now() - args.since_days*86400000).toISOString())
      const { data, error } = await q.order('ref_date', { ascending: false, nullsFirst: false }).limit(args.limit || 20)
      if (error) throw error
      return { count: data.length, results: data, mode: 'text' }
    }
    case 'kb_open': {
      const { data: ptr, error: pErr } = await supabase.from('carmen_memory_pointers')
        .select('*').eq('id', args.pointer_id).in('tenant_id', accessibleTenantIds).maybeSingle()
      if (pErr) throw pErr
      if (!ptr) return { error: 'pointer not found' }
      // Fetch live row from source
      let live: any = null
      try {
        const tableMap: Record<string,string> = { client: 'clients', campaigner: 'campaigners', task: 'tasks', message: 'chat_messages', lead: 'leads', report: 'seo_reports', system: '' }
        const table = tableMap[ptr.entity_type] ?? ptr.entity_type
        if (table) {
          const { data } = await supabase.from(table).select('*').eq('id', ptr.entity_id).maybeSingle()
          live = data
        }
      } catch (_) {/* ignore */}
      // Bump access count async
      supabase.from('carmen_memory_pointers').update({ updated_at: new Date().toISOString() }).eq('id', ptr.id).then(()=>{})
      return { pointer: ptr, live }
    }
    case 'kb_recall_conversation': {
      let q = supabase.from('carmen_memory_episodes')
        .select('id, topic, topic_tags, summary, source_table, source_ids, ref_date, importance, retention_score')
        .in('tenant_id', accessibleTenantIds)
      if (args.topic) q = q.ilike('topic', `%${args.topic}%`)
      if (args.query) q = q.or(`topic.ilike.%${args.query}%,summary.ilike.%${args.query}%`)
      if (args.since_days) q = q.gte('ref_date', new Date(Date.now() - args.since_days*86400000).toISOString())
      const { data, error } = await q.order('ref_date', { ascending: false, nullsFirst: false }).limit(args.limit || 10)
      if (error) throw error
      // Bump access count on returned episodes (non-blocking)
      if (data?.length) {
        supabase.from('carmen_memory_episodes')
          .update({ last_accessed_at: new Date().toISOString() })
          .in('id', data.map((d: any) => d.id)).then(()=>{})
      }
      return { count: data.length, episodes: data }
    }
    case 'kb_learn': {
      // Generate embedding (best-effort)
      let embedding: number[] | null = null
      try {
        embedding = await aiEmbed(`${args.topic}\n\n${args.summary}`)
      } catch (_) {/* ignore */}
      const { data, error } = await supabase.from('carmen_memory_episodes').insert({
        tenant_id: tenantId,
        topic: args.topic,
        topic_tags: args.topic_tags || [],
        summary: args.summary,
        summary_embedding: embedding,
        source_table: args.source_table || null,
        source_ids: args.source_ids || [],
        importance: Math.max(1, Math.min(10, args.importance || 5)),
        retention_score: 1.0,
        ref_date: new Date().toISOString(),
      }).select('id, topic').single()
      if (error) throw error
      return { learned: true, episode_id: data.id, topic: data.topic }
    }
    // CHAT HISTORY
    case 'get_chat_history': {
      const filterCol = args.contact_type === 'client' ? 'client_id' : 'lead_id'
      const { data, error } = await supabase.from('chat_messages').select('id, message_text, direction, sender_name, created_at')
        .in('tenant_id', accessibleTenantIds).eq(filterCol, args.contact_id)
        .order('created_at', { ascending: false }).limit(args.limit || 20)
      if (error) throw error
      return { count: data.length, messages: data.reverse() }
    }
    case 'search_conversation_history': {
      const rawQuery = String(args.query || '').trim()
      // AND semantics: every token must appear in the message. Up to 4 tokens.
      // No query = browse mode: chronological slice of the window, which then
      // MUST be narrowed (Carmen channel / specific phone) or the whole tenant's
      // WhatsApp traffic floods the result.
      const tokens = rawQuery.split(/\s+/).filter(Boolean).slice(0, 4)
      const browseMode = tokens.length === 0
      const daysBack = Math.min(Number(args.days_back) > 0 ? Number(args.days_back) : 180, 730)
      const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString()
      const defaultLimit = browseMode ? 40 : 20
      const withPhone = String(args.with_phone || '').replace(/\D/g, '')
      const onlyCarmen = args.only_carmen_chats === true || (browseMode && args.only_carmen_chats !== false)
      let q = supabase.from('chat_messages')
        .select('message_text, direction, sender_name, sender_phone, created_at, group_id, provider, clients(name)')
        .in('tenant_id', accessibleTenantIds)
        .gte('created_at', since)
        .not('message_text', 'is', null)
        .order('created_at', { ascending: false })
        .limit(Math.min(Number(args.limit) > 0 ? Number(args.limit) : defaultLimit, 60))
      for (const t of tokens) q = q.ilike('message_text', `%${t}%`)
      if (onlyCarmen) q = q.eq('provider', 'manus_wa')
      if (withPhone) q = q.ilike('sender_phone', `%${withPhone}%`)
      const { data, error } = await q
      if (error) throw error
      const fmt = (iso: string) => new Date(iso).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem', dateStyle: 'short', timeStyle: 'short' })
      return {
        count: data.length,
        mode: browseMode ? 'browse' : 'keyword_search',
        note: data.length === 0
          ? (browseMode
              ? 'אין הודעות בחלון הזמן — נסי days_back גדול יותר או only_carmen_chats=false.'
              : 'אין תוצאות — נסי מילת תוכן אחרת (שם פרטי בלבד, חלק מהמייל, מילה נרדפת) או דפדוף בלי query.')
          : undefined,
        messages: data.reverse().map((m: any) => ({
          when_israel: fmt(m.created_at),
          direction: m.direction,
          from: m.sender_name || m.sender_phone || '',
          client: m.clients?.name || null,
          in_group: !!m.group_id,
          text: String(m.message_text).slice(0, 400),
        })),
      }
    }
    case 'get_recent_inbound_messages': {
      const hoursAgo = args.hours || 24
      const since = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString()
      const { data, error } = await supabase.from('chat_messages')
        .select('id, message_text, sender_name, sender_phone, created_at, client_id, lead_id, clients(name), leads(company_name)')
        .in('tenant_id', accessibleTenantIds).eq('direction', 'inbound').gte('created_at', since)
        .order('created_at', { ascending: false }).limit(args.limit || 30)
      if (error) throw error
      return { count: data.length, messages: data.map((m: any) => ({ ...m, contact_name: m.clients?.name || m.leads?.company_name || m.sender_name || m.sender_phone })) }
    }
    // FINANCE
    case 'list_finance': {
      let query = supabase.from('finance').select('id, amount, type, description, date, client_id, clients(name)').in('tenant_id', accessibleTenantIds).order('date', { ascending: false }).limit(args.limit || 20)
      if (args.client_id) query = query.eq('client_id', args.client_id)
      if (args.type) query = query.eq('type', args.type)
      const { data, error } = await query
      if (error) throw error
      return { count: data.length, entries: data.map((f: any) => ({ ...f, client_name: f.clients?.name })) }
    }
    case 'create_finance_entry': {
      const { data, error } = await supabase.from('finance').insert({
        amount: args.amount, type: args.type, description: args.description,
        date: args.date || new Date().toISOString().split('T')[0],
        client_id: args.client_id || null, tenant_id: tenantId,
      }).select('id, amount, type, description').single()
      if (error) throw error
      return { finance_id: data.id, amount: data.amount, type: data.type }
    }
    case 'get_finance_summary': {
      const month = args.month || new Date().toISOString().slice(0, 7)
      const startDate = `${month}-01`
      const endDate = new Date(parseInt(month.split('-')[0]), parseInt(month.split('-')[1]), 0).toISOString().split('T')[0]
      const { data, error } = await supabase.from('finance').select('amount, type').in('tenant_id', accessibleTenantIds).gte('date', startDate).lte('date', endDate)
      if (error) throw error
      const income = (data || []).filter((f: any) => f.type === 'income').reduce((s: number, f: any) => s + (f.amount || 0), 0)
      const expense = (data || []).filter((f: any) => f.type === 'expense').reduce((s: number, f: any) => s + (f.amount || 0), 0)
      return { month, income, expense, profit: income - expense, entries_count: data.length }
    }
    // UPDATES
    case 'list_updates': {
      const table = args.entity_type === 'client' ? 'client_updates' : 'lead_updates'
      const idCol = args.entity_type === 'client' ? 'client_id' : 'lead_id'
      const { data, error } = await supabase.from(table).select('id, content, created_at').eq(idCol, args.entity_id).order('created_at', { ascending: false }).limit(args.limit || 10)
      if (error) throw error
      return { count: data.length, updates: data }
    }
    // GOALS
    case 'create_goal': {
      const { data, error } = await supabase.from('goals').insert({
        tenant_id: tenantId,
        title: args.title,
        description: args.description || null,
