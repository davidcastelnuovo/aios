/**
 * Deterministic campaign-pulse classification helpers.
 * Shared by campaign-pulse-snapshot (and unit-tested) so connected clients with
 * stale sync are never collapsed into no_data.
 */

export const CAMPAIGN_SERVICES = new Set(['ppc_meta', 'ppc_google'])
export const CAMPAIGN_TABLE_TYPES = ['facebook_insights', 'facebook_ecommerce', 'google_ads'] as const
export const CLIENT_CALL_STALE_MS = 14 * 24 * 60 * 60 * 1000
/**
 * Sync cadence is twice-daily (05:xx / 12:xx UTC). When a noon run misses a
 * table, the next morning gap is ~24h — and the morning pulse often races the
 * 05:xx sync. 18h produced false "sync old" for healthy Google/Meta tables.
 * 30h covers a full day + buffer without hiding truly abandoned syncs.
 */
export const STALE_SYNC_MS = 30 * 60 * 60 * 1000

export type PulseStatus = 'healthy' | 'warning' | 'critical' | 'no_data'

export type CampaignTableLike = {
  id?: string
  integration_type?: string | null
  campaign_active?: boolean | null
  last_sync_at?: string | null
  integration_settings?: Record<string, unknown> | null
}

/** Prefer the freshest of column vs settings last_sync_at. */
export function resolveLastSyncAt(table: CampaignTableLike): string | null {
  const settings = table.integration_settings || {}
  const candidates = [table.last_sync_at, settings.last_sync_at]
    .map((value) => (typeof value === 'string' && value.trim() ? value : null))
    .filter((value): value is string => !!value)
  if (!candidates.length) return null
  return candidates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]
}

export function isSyncStale(table: CampaignTableLike, nowMs = Date.now(), staleMs = STALE_SYNC_MS): boolean {
  const lastSync = resolveLastSyncAt(table)
  if (!lastSync) return true
  const ts = new Date(lastSync).getTime()
  if (Number.isNaN(ts)) return true
  return nowMs - ts > staleMs
}

export function platformLabel(integrationType: string | null | undefined): string {
  if (integrationType === 'google_ads') return 'Google'
  if (integrationType === 'facebook_insights' || integrationType === 'facebook_ecommerce') return 'Meta'
  return String(integrationType || 'unknown')
}

export function platformKey(integrationType: string | null | undefined): 'meta' | 'google' | null {
  if (integrationType === 'google_ads') return 'google'
  if (integrationType === 'facebook_insights' || integrationType === 'facebook_ecommerce') return 'meta'
  return null
}

/**
 * Per platform, keep only the freshest active table. Abandoned duplicate Meta
 * tables (e.g. old facebook_ecommerce alongside a fresh insights/ecommerce row)
 * must not flag a healthy connection.
 */
export function pickFreshestTablePerPlatform(tables: CampaignTableLike[]): CampaignTableLike[] {
  const best = new Map<string, CampaignTableLike>()
  for (const table of tables) {
    if (table.campaign_active === false) continue
    const key = platformKey(table.integration_type)
    if (!key) continue
    const prev = best.get(key)
    if (!prev) {
      best.set(key, table)
      continue
    }
    const prevTs = resolveLastSyncAt(prev)
    const nextTs = resolveLastSyncAt(table)
    if (!prevTs && nextTs) {
      best.set(key, table)
      continue
    }
    if (prevTs && nextTs && new Date(nextTs).getTime() > new Date(prevTs).getTime()) {
      best.set(key, table)
    }
  }
  return Array.from(best.values())
}

/** Absolute tenant pulse-dashboard URL (must include `/t/` for App routing). */
export function buildPulseDashboardAbsoluteUrl(
  tenantSlug: string,
  origin = 'https://aios.co.il',
  agencyId?: string | null,
): string {
  const base = `${origin.replace(/\/$/, '')}/t/${tenantSlug}/dmm-dashboard`
  if (agencyId && agencyId !== 'all') {
    return `${base}?agency=${encodeURIComponent(agencyId)}`
  }
  return base
}

/**
 * Short WhatsApp health digest: counts + dashboard link only.
 * Never lists per-client sync/account issues on WhatsApp.
 */
export function buildHealthWhatsAppDigest(input: {
  activeConnections: number
  systemChecks: number
  okChecks: number
  issueCount: number
  dashboardUrl: string
}): string {
  const lines = [
    '*בדיקת תקינות מערכות וקמפיינים*',
    `נבדקו ${input.activeConnections} חיבורי קמפיינים פעילים ו-${input.systemChecks} שירותי מערכת.`,
  ]
  if (input.issueCount === 0) {
    lines.push(
      `🟢 הכול תקין — ${input.activeConnections} חיבורי קמפיינים פעילים ו-${input.okChecks} שירותים מחוברים ללא שגיאות.`,
    )
  } else {
    lines.push(`נמצאו ${input.issueCount} נקודות לטיפול — הפירוט בדשבורד בלבד.`)
  }
  lines.push('', 'צפה בדשבורד בדיקת דופק:', input.dashboardUrl)
  lines.push('', 'פירוט לקוח-לקוח וטבלאות לא מחוברות — בדשבורד בלבד (לא בוואטסאפ).')
  return lines.join('\n')
}

/** Ecommerce metrics when client flag is set OR an active facebook_ecommerce table exists. */
export function effectiveIsEcommerce(
  clientIsEcommerce: boolean | null | undefined,
  tables: CampaignTableLike[],
): boolean {
  if (clientIsEcommerce) return true
  return tables.some((table) => table.integration_type === 'facebook_ecommerce' && table.campaign_active !== false)
}

export function clientCampaignServices(services: unknown): Set<string> {
  return new Set(
    (Array.isArray(services) ? services : [])
      .map((service) => String(service))
      .filter((service) => CAMPAIGN_SERVICES.has(service)),
  )
}

export function tableMatchesServices(table: CampaignTableLike, services: Set<string>): boolean {
  if (table.integration_type === 'google_ads') return services.has('ppc_google')
  if (table.integration_type === 'facebook_insights' || table.integration_type === 'facebook_ecommerce') {
    return services.has('ppc_meta')
  }
  return false
}

export type ClassifyPulseInput = {
  /** Active (campaign_active !== false) tables matched to the client's services. */
  activeTables: CampaignTableLike[]
  /** True when at least one campaign-report table exists for an expected service (even if all paused). */
  hasConfiguredCampaignTable: boolean
  recentRecordCount: number
  isEcommerce: boolean
  spend7: number
  leads7: number
  purchases7: number
  roas: number | null
  cplChangePct: number | null
  /** Latest client-card update with update_type='call'. Undefined skips this rule. */
  lastClientCallAt?: string | null
  nowMs?: number
}

function applyClientCallFreshness(
  status: PulseStatus,
  flags: string[],
  lastClientCallAt: string | null | undefined,
  nowMs: number,
): { status: PulseStatus; flags: string[] } {
  if (lastClientCallAt === undefined) return { status, flags }

  const timestamp = lastClientCallAt ? new Date(lastClientCallAt).getTime() : Number.NaN
  const missing = Number.isNaN(timestamp)
  const stale = !missing && nowMs - timestamp > CLIENT_CALL_STALE_MS
  if (!missing && !stale) return { status, flags }

  flags.push(missing
    ? 'לא תועדה שיחה טלפונית עם הלקוח'
    : 'לא תועדה שיחה טלפונית עם הלקוח ב-14 הימים האחרונים')
  return { status: status === 'healthy' ? 'warning' : status, flags }
}

/**
 * Classify a client row for the deterministic campaign pulse.
 *
 * - no_data: no campaign report table connected for expected services
 * - warning: tables connected but sync/data stale, or soft metric issues
 * - critical / healthy: metric-driven when recent data exists
 */
export function classifyCampaignPulseStatus(input: ClassifyPulseInput): {
  status: PulseStatus
  flags: string[]
  stalePlatforms: string[]
} {
  const flags: string[] = []
  const nowMs = input.nowMs ?? Date.now()
  // Stale = freshest table per platform is stale (ignore abandoned duplicates).
  const stalePlatforms = pickFreshestTablePerPlatform(input.activeTables)
    .filter((table) => isSyncStale(table, nowMs))
    .map((table) => platformLabel(table.integration_type))

  if (!input.hasConfiguredCampaignTable || input.activeTables.length === 0) {
    const result = applyClientCallFreshness(
      'no_data',
      ['אין טבלת קמפיין מחוברת'],
      input.lastClientCallAt,
      nowMs,
    )
    return {
      ...result,
      stalePlatforms,
    }
  }

  if (input.recentRecordCount === 0) {
    const staleNote = stalePlatforms.length
      ? ` (${stalePlatforms.join(', ')})`
      : ''
    const result = applyClientCallFreshness(
      'warning',
      [`סנכרון ישן או חסר — אין נתונים ב-30 הימים האחרונים${staleNote}`],
      input.lastClientCallAt,
      nowMs,
    )
    return { ...result, stalePlatforms }
  }

  let status: PulseStatus = 'healthy'
  if (input.isEcommerce) {
    if (input.spend7 > 0 && input.purchases7 === 0) {
      status = 'critical'
      flags.push('הוצאה ללא רכישות')
    } else if (input.roas !== null && input.roas < 1) {
      status = 'critical'
      flags.push('ROAS נמוך מ-1')
    } else if (input.roas !== null && input.roas < 1.5) {
      status = 'warning'
      flags.push('ROAS נמוך')
    }
  } else if (input.spend7 > 0 && input.leads7 === 0) {
    status = 'critical'
    flags.push('הוצאה ללא לידים')
  } else if (input.cplChangePct !== null && input.cplChangePct > 25) {
    status = 'warning'
    flags.push(`CPL עלה ב-${Math.round(input.cplChangePct * 10) / 10}%`)
  }

  if (stalePlatforms.length) {
    flags.push(`סנכרון ישן או חסר: ${stalePlatforms.join(', ')}`)
    if (status === 'healthy') status = 'warning'
  }

  const result = applyClientCallFreshness(status, flags, input.lastClientCallAt, nowMs)
  return { ...result, stalePlatforms }
}

export type PulseStatusCounts = {
  total: number
  healthy: number
  warning: number
  critical: number
  no_data: number
  /** warning + no_data — matches morning WA digest "לתשומת לב" bucket. */
  attention: number
}

export function countPulseStatuses(rows: Array<{ status?: string | null }>): PulseStatusCounts {
  const count = (status: string) => rows.filter((row) => row.status === status).length
  const warning = count('warning')
  const no_data = count('no_data')
  return {
    total: rows.length,
    healthy: count('healthy'),
    warning,
    critical: count('critical'),
    no_data,
    attention: warning + no_data,
  }
}

/**
 * Short WhatsApp pulse message: status counts + dashboard link only.
 * Policy: never paste per-client Markdown tables on WhatsApp.
 */
export function buildPulseWhatsAppDigest(
  rows: Array<{ status?: string | null; client_name?: string | null }>,
  dashboardUrl: string,
): string {
  const counts = countPulseStatuses(rows)
  if (rows.length === 1) {
    const statusLabel: Record<string, string> = {
      healthy: '🟢 תקין',
      warning: '🟡 תשומת לב',
      critical: '🔴 קריטי',
      no_data: '🟡 אין טבלת קמפיין מחוברת',
    }
    const row = rows[0]
    const label = statusLabel[String(row.status || '')] || String(row.status || '—')
    const name = row.client_name ? ` — ${row.client_name}` : ''
    return [
      `*בדיקת דופק${name}*`,
      `סטטוס: ${label}`,
      '',
      'פירוט מלא בדשבורד בדיקת דופק:',
      dashboardUrl,
      '',
      'טבלאות לא מחוברות ופירוט לפי לקוח — בדשבורד בלבד (לא בוואטסאפ).',
    ].join('\n')
  }
  return [
    '*בדיקת דופק הושלמה*',
    `נבדקו ${counts.total} לקוחות קמפיין פעילים: 🟢 ${counts.healthy} תקינים | 🟡 ${counts.attention} לתשומת לב | 🔴 ${counts.critical} קריטיים`,
    '',
    'צפה בדשבורד בדיקת דופק:',
    dashboardUrl,
    '',
    'טבלאות לא מחוברות ופירוט לפי לקוח — בדשבורד בלבד (לא בוואטסאפ).',
  ].join('\n')
}

/** Surfaces that must never receive the full pulse Markdown table. */
export function pulseSurfacePrefersWhatsAppDigest(surface: string | null | undefined): boolean {
  return surface === 'whatsapp' || surface === 'task'
}
