/**
 * Deterministic campaign-pulse classification helpers.
 * Shared by campaign-pulse-snapshot (and unit-tested) so connected clients with
 * stale sync are never collapsed into no_data.
 */

export const CAMPAIGN_SERVICES = new Set(['ppc_meta', 'ppc_google'])
export const CAMPAIGN_TABLE_TYPES = ['facebook_insights', 'facebook_ecommerce', 'google_ads'] as const
export const STALE_SYNC_MS = 18 * 60 * 60 * 1000

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
  nowMs?: number
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
  const stalePlatforms = Array.from(new Set(
    input.activeTables
      .filter((table) => isSyncStale(table, nowMs))
      .map((table) => platformLabel(table.integration_type)),
  ))

  if (!input.hasConfiguredCampaignTable || input.activeTables.length === 0) {
    return {
      status: 'no_data',
      flags: ['אין טבלת קמפיין מחוברת'],
      stalePlatforms,
    }
  }

  if (input.recentRecordCount === 0) {
    const staleNote = stalePlatforms.length
      ? ` (${stalePlatforms.join(', ')})`
      : ''
    return {
      status: 'warning',
      flags: [`סנכרון ישן או חסר — אין נתונים ב-30 הימים האחרונים${staleNote}`],
      stalePlatforms,
    }
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

  return { status, flags, stalePlatforms }
}
