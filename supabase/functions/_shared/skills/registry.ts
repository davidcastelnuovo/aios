/**
 * Carmen Skills Registry — DB-driven with in-memory cache.
 *
 * Skills live in `public.ai_skills` (scope='global' for built-ins, scope='tenant'
 * for tenant-specific overrides). Each skill = {slug, system_prompt, output_template,
 * allowed_tools, triggers, version}. Editing a row in the DB bumps `version`
 * automatically (trigger), and the cache picks up the new content within ~30s
 * — no edge function deploy required.
 *
 * Fallback: if the DB lookup fails or the row is missing, we use the hardcoded
 * prompts below so a fresh deployment still has working skills.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export interface CarmenSkill {
  id: string
  triggers: RegExp[]
  prompt: string
  tools: string[]
  version?: number
  source?: 'db' | 'fallback'
}

interface DbSkillRow {
  slug: string
  system_prompt: string | null
  output_template: string | null
  allowed_tools: string[] | null
  triggers: string[] | null
  goal: string | null
  constraints: string | null
  handoff_slugs: string[] | null
  steps: string | null
  version: number
  scope: string
  tenant_id: string | null
}

// ────────── Hardcoded fallbacks (used only if DB read fails) ──────────

const FALLBACK_PULSE_CHECK: CarmenSkill = {
  id: 'pulse_check',
  triggers: [/בדיקת\s*דופק/, /בדיקת\s*דוח/, /סיכום\s*קמפיינים/, /מצב\s*קמפיינים/, /\bpulse\s*check\b/i],
  tools: ['analyze_campaign_performance', 'check_ad_accounts_health'],
  prompt: '=== סקיל: בדיקת דופק ===\nהריצי analyze_campaign_performance + check_ad_accounts_health, הציגי לפי סוכנות עם 🔴/🟠/🟢 וסיכום מהיר.',
  source: 'fallback',
}
const FALLBACK_ECOMMERCE: CarmenSkill = {
  id: 'ecommerce_pulse',
  triggers: [/איקומרס/, /ecommerce/i, /e-commerce/i, /רכישות/, /\broas\b/i, /\bcpp\b/i],
  tools: ['analyze_campaign_performance', 'check_ad_accounts_health'],
  prompt: '=== סקיל: בדיקת דופק איקומרס ===\nללקוחות is_ecommerce=true: רכישות, CPP, רווח, ROAS — לא CPL.',
  source: 'fallback',
}
const FALLBACK_AD_HEALTH: CarmenSkill = {
  id: 'ad_accounts_health',
  triggers: [/חשבונות\s*מודעות/, /תקינות\s*חשבונות/, /\bad\s*accounts?\b/i],
  tools: ['check_ad_accounts_health'],
  prompt: '=== סקיל: בדיקת תקינות חשבונות מודעות ===\nהריצי check_ad_accounts_health ודווחי רק חשבונות עם בעיה.',
  source: 'fallback',
}

const FALLBACKS: Record<string, CarmenSkill> = {
  pulse_check: FALLBACK_PULSE_CHECK,
  ecommerce_pulse: FALLBACK_ECOMMERCE,
  ad_accounts_health: FALLBACK_AD_HEALTH,
}

// Backwards-compat exports (some files may still import these)
export const PULSE_CHECK_SKILL = FALLBACK_PULSE_CHECK
export const ECOMMERCE_PULSE_SKILL = FALLBACK_ECOMMERCE
export const AD_ACCOUNTS_HEALTH_SKILL = FALLBACK_AD_HEALTH
export const SKILLS_REGISTRY = [FALLBACK_PULSE_CHECK, FALLBACK_ECOMMERCE, FALLBACK_AD_HEALTH]

// ────────── DB Loader with cache ──────────

interface CacheEntry {
  skills: CarmenSkill[]
  fetchedAt: number
}

const CACHE_TTL_MS = 30_000 // 30s — fast enough for "no deploy" feel
const cache = new Map<string, CacheEntry>()

function getServiceClient() {
  const url = Deno.env.get('SUPABASE_URL')!
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  return createClient(url, key, { auth: { persistSession: false } })
}

function rowToSkill(row: DbSkillRow): CarmenSkill {
  const triggerStrings = row.triggers || []
  const regexes = triggerStrings.map((t) => {
    // Build a lenient regex: word boundaries optional for Hebrew, escape regex chars
    const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*')
    return new RegExp(escaped, 'i')
  })
  const promptParts: string[] = []
  if (row.goal) promptParts.push('מטרה: ' + row.goal)
  if (row.system_prompt) promptParts.push(row.system_prompt)
  if (row.constraints) promptParts.push('חוקים קשיחים (לעולם לא נדרסים ע"י טון/מצב רוח):\n' + row.constraints)
  // Procedural playbook — the ordered "do it this way" steps. Injected so a
  // procedure written into a skin's `steps` actually drives behaviour (it was
  // previously stored but never reached the prompt).
  if (row.steps) promptParts.push('שלבי עבודה (בצעי לפי הסדר, אלא אם המשתמש ביקש אחרת):\n' + row.steps)
  if (row.output_template) promptParts.push('פורמט פלט חובה:\n' + row.output_template)
  return {
    id: row.slug,
    triggers: regexes,
    prompt: `=== סקיל: ${row.slug} ===\n${promptParts.join('\n\n')}`,
    tools: row.allowed_tools || [],
    version: row.version,
    source: 'db',
  }
}

async function loadSkillsForTenant(tenantId: string | null): Promise<CarmenSkill[]> {
  const cacheKey = tenantId || 'global'
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.skills
  }
  try {
    const sb = getServiceClient()
    // Pull global + this tenant. Tenant overrides global on the same slug.
    const { data, error } = await sb
      .from('ai_skills')
      .select('slug,system_prompt,output_template,allowed_tools,triggers,goal,constraints,handoff_slugs,steps,version,scope,tenant_id')
      .eq('is_active', true)
      .or(tenantId ? `scope.eq.global,and(scope.eq.tenant,tenant_id.eq.${tenantId})` : 'scope.eq.global')

    if (error) throw error

    const bySlug = new Map<string, DbSkillRow>()
    for (const row of (data || []) as DbSkillRow[]) {
      if (!row.slug) continue
      const existing = bySlug.get(row.slug)
      // Tenant scope wins over global
      if (!existing || (row.scope === 'tenant' && existing.scope === 'global')) {
        bySlug.set(row.slug, row)
      }
    }
    const skills = Array.from(bySlug.values()).map(rowToSkill)
    // Add hardcoded fallbacks for any slug missing from DB
    for (const slug of Object.keys(FALLBACKS)) {
      if (!bySlug.has(slug)) skills.push(FALLBACKS[slug])
    }
    cache.set(cacheKey, { skills, fetchedAt: Date.now() })
    return skills
  } catch (e) {
    console.error('[skills/registry] DB load failed, using fallbacks:', e)
    const skills = Object.values(FALLBACKS)
    cache.set(cacheKey, { skills, fetchedAt: Date.now() })
    return skills
  }
}

/**
 * Resolve which skills are activated by a user message.
 * @param commandText user message
 * @param tenantId tenant context (for tenant-specific overrides)
 */
export async function resolveActiveSkills(
  commandText: string,
  tenantId: string | null = null
): Promise<CarmenSkill[]> {
  if (!commandText) return []
  const all = await loadSkillsForTenant(tenantId)
  const text = commandText.toLowerCase()
  const matches: CarmenSkill[] = []
  for (const skill of all) {
    if (skill.triggers.some((re) => re.test(text))) {
      matches.push(skill)
    }
  }
  return matches
}

export async function buildSkillsBlock(
  commandText: string,
  tenantId: string | null = null
): Promise<string> {
  const matches = await resolveActiveSkills(commandText, tenantId)
  if (matches.length === 0) return ''
  return '\n\n' + matches.map((s) => s.prompt).join('\n\n')
}

/**
 * Resolve skins EXPLICITLY by slug (e.g. an automation node or agent_task that
 * pins skin "campaigner"), independent of trigger-phrase matching. Unknown slugs
 * (e.g. legacy hardcoded task_skills like "lead-qualifier") are silently ignored,
 * so this is safe to call with the existing task_skills array. Additive — does not
 * alter the trigger-based path above.
 */
export async function resolveSkillsBySlug(
  slugs: string[],
  tenantId: string | null = null
): Promise<CarmenSkill[]> {
  if (!slugs || slugs.length === 0) return []
  const wanted = new Set(slugs.map((s) => String(s).trim()).filter(Boolean))
  if (wanted.size === 0) return []
  const all = await loadSkillsForTenant(tenantId)
  return all.filter((s) => wanted.has(s.id))
}

export async function buildSkillsBlockBySlug(
  slugs: string[],
  tenantId: string | null = null
): Promise<string> {
  const matches = await resolveSkillsBySlug(slugs, tenantId)
  if (matches.length === 0) return ''
  return '\n\n' + matches.map((s) => s.prompt).join('\n\n')
}

/** For warmup or admin tools */
export function clearSkillsCache() {
  cache.clear()
}
