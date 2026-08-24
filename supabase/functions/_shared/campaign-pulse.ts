/**
 * Deterministic campaign-pulse classification helpers.
 * Shared by campaign-pulse-snapshot (and unit-tested) so connected clients with
 * stale sync are never collapsed into no_data.
 */

export const CAMPAIGN_SERVICES = new Set(['ppc_meta', 'ppc_google'])
export const CAMPAIGN_TABLE_TYPES = ['facebook_insights', 'facebook_ecommerce', 'google_ads'] as const
export const CLIENT_CALL_STALE_MS = 14 * 24 * 60 * 60 * 1000
/** Alert types worth interrupting someone's morning for. */
export const PULSE_CRITICAL_ALERT_TYPES = ['campaign_stopped', 'ad_disapproved'] as const
/** Keep the WhatsApp digest readable — remaining issues are counted, not listed. */
export const PULSE_CRITICAL_LINE_LIMIT = 5
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
  return lines.join('\n')
}

const ALERT_TYPE_LABELS: Record<string, string> = {
  campaign_stopped: 'קמפיין נעצר',
  ad_disapproved: 'מודעה נדחתה',
  campaign_with_issues: 'תקלה בקמפיין',
  cpl_spike: 'CPL חורג',
}

export type CampaignAlertLike = {
  alert_type?: string | null
  severity?: string | null
  client_id?: string | null
  ad_account_id?: string | null
  campaign_id?: string | null
  campaign_name?: string | null
}

/** Client an alert can be attributed to. */
export type PulseAlertClient = {
  clientId: string
  clientName?: string | null
  adAccountIds: string[]
  /** Alerts are only reported for clients whose campaign table is still active. */
  hasActiveCampaignTable: boolean
}

export type PulseCriticalIssue = {
  clientId: string
  clientName: string | null
  alertType: string
  label: string
  campaignName: string | null
}

/** Meta reports `act_123`; table settings often store the bare id. */
export function normalizeAdAccountId(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().replace(/^act_/i, '')
  return trimmed ? trimmed : null
}

/** Every ad-account id configured on a client's campaign tables. */
export function clientAdAccountIds(tables: CampaignTableLike[]): string[] {
  const ids = new Set<string>()
  for (const table of tables) {
    const settings = table.integration_settings || {}
    for (const key of ['ad_account_id', 'account_id', 'meta_account_id', 'customer_id']) {
      const id = normalizeAdAccountId(settings[key])
      if (id) ids.add(id)
    }
  }
  return Array.from(ids)
}

function isCriticalAlert(alert: CampaignAlertLike): boolean {
  const type = String(alert.alert_type || '')
  if ((PULSE_CRITICAL_ALERT_TYPES as readonly string[]).includes(type)) return true
  return String(alert.severity || '') === 'critical'
}

/**
 * Attribute open critical campaign alerts to clients.
 *
 * Meta's monitor records the ad account but usually no client_id, so fall back to
 * matching on ad account. An alert that cannot be tied to a client with an active
 * campaign table is dropped rather than reported against the wrong client.
 */
export function selectPulseCriticalAlerts(
  alerts: CampaignAlertLike[],
  clients: PulseAlertClient[],
): PulseCriticalIssue[] {
  const byClientId = new Map<string, PulseAlertClient>()
  const byAdAccount = new Map<string, PulseAlertClient>()
  for (const client of clients) {
    byClientId.set(client.clientId, client)
    for (const adAccountId of client.adAccountIds) {
      if (!byAdAccount.has(adAccountId)) byAdAccount.set(adAccountId, client)
    }
  }

  const issues: PulseCriticalIssue[] = []
  const seen = new Set<string>()
  for (const alert of alerts) {
    if (!isCriticalAlert(alert)) continue
    const adAccountId = normalizeAdAccountId(alert.ad_account_id)
    const client = (alert.client_id ? byClientId.get(alert.client_id) : undefined)
      ?? (adAccountId ? byAdAccount.get(adAccountId) : undefined)
    if (!client || !client.hasActiveCampaignTable) continue

    const alertType = String(alert.alert_type || 'alert')
    const campaignName = alert.campaign_name || alert.campaign_id || null
    const key = `${client.clientId}|${alertType}|${campaignName ?? ''}`
    if (seen.has(key)) continue
    seen.add(key)
    issues.push({
      clientId: client.clientId,
      clientName: client.clientName || null,
      alertType,
      label: ALERT_TYPE_LABELS[alertType] || alertType,
      campaignName,
    })
  }
  return issues.sort((a, b) => (a.clientName || '').localeCompare(b.clientName || '', 'he'))
}

export function countStoppedCampaignsByClient(issues: PulseCriticalIssue[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const issue of issues) {
    if (issue.alertType !== 'campaign_stopped') continue
    counts.set(issue.clientId, (counts.get(issue.clientId) || 0) + 1)
  }
  return counts
}

function criticalIssueLines(issues: PulseCriticalIssue[]): string[] {
  if (!issues.length) return []
  const lines = ['', '🔴 דורש טיפול:']
  for (const issue of issues.slice(0, PULSE_CRITICAL_LINE_LIMIT)) {
    const client = issue.clientName || 'לקוח לא מזוהה'
    const campaign = issue.campaignName ? ` — ${issue.campaignName}` : ''
    lines.push(`• ${client}: ${issue.label}${campaign}`)
  }
  const remaining = issues.length - PULSE_CRITICAL_LINE_LIMIT
  if (remaining > 0) lines.push(`• ועוד ${remaining} התראות קריטיות בדשבורד`)
  return lines
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
  /** Open `campaign_stopped` alerts attributed to this client's active tables. */
  stoppedCampaignCount?: number
  nowMs?: number
}

function applyStoppedCampaigns(
  status: PulseStatus,
  flags: string[],
  stoppedCampaignCount: number | undefined,
): { status: PulseStatus; flags: string[] } {
  const count = stoppedCampaignCount ?? 0
  if (count <= 0) return { status, flags }
  flags.push(count === 1 ? 'קמפיין נעצר' : `${count} קמפיינים נעצרו`)
  return { status: 'critical', flags }
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
    const stopped = applyStoppedCampaigns(
      'warning',
      [`סנכרון ישן או חסר — אין נתונים ב-30 הימים האחרונים${staleNote}`],
      input.stoppedCampaignCount,
    )
    const result = applyClientCallFreshness(
      stopped.status,
      stopped.flags,
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

  const stopped = applyStoppedCampaigns(status, flags, input.stoppedCampaignCount)
  const result = applyClientCallFreshness(stopped.status, stopped.flags, input.lastClientCallAt, nowMs)
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
  criticalIssues: PulseCriticalIssue[] = [],
): string {
  const counts = countPulseStatuses(rows)
  const issueLines = criticalIssueLines(criticalIssues)
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
      ...issueLines,
      '',
      'פירוט מלא בדשבורד בדיקת דופק:',
      dashboardUrl,
    ].join('\n')
  }
  return [
    '*בדיקת דופק הושלמה*',
    `נבדקו ${counts.total} לקוחות קמפיין פעילים: 🟢 ${counts.healthy} תקינים | 🟡 ${counts.attention} לתשומת לב | 🔴 ${counts.critical} קריטיים`,
    ...issueLines,
    '',
    'צפה בדשבורד בדיקת דופק:',
    dashboardUrl,
  ].join('\n')
}

/** Surfaces that must never receive the full pulse Markdown table. */
export function pulseSurfacePrefersWhatsAppDigest(surface: string | null | undefined): boolean {
  return surface === 'whatsapp' || surface === 'task'
}
