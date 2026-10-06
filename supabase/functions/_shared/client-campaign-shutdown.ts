/**
 * Deterministic evening client campaign verify/shutdown for scheduled agent_tasks.
 * Default scope is all live client campaigns — not webinar-name filtering unless explicitly requested.
 */

export type CampaignShutdownScope =
  | { mode: 'all_client_campaigns' }
  | { mode: 'name_includes'; terms: string[] }

export type ShutdownCampaignRow = {
  campaign_id: string
  campaign_name: string
  effective_status: string
}

export type CampaignShutdownJob = {
  client_id?: string | null
  client_name_search?: string | null
  scope?: CampaignShutdownScope
  auto_pause?: boolean
  notify_david?: boolean
}

export type CampaignShutdownRunResult = {
  client_id: string
  client_name: string
  scope: CampaignShutdownScope
  checked: ShutdownCampaignRow[]
  skipped_out_of_scope: ShutdownCampaignRow[]
  already_paused: ShutdownCampaignRow[]
  newly_paused: ShutdownCampaignRow[]
  still_active: ShutdownCampaignRow[]
  pause_errors: Array<{ campaign_id: string; campaign_name: string; error: string }>
  report: string
}

const TERMINAL_STATUSES = new Set(['DELETED', 'ARCHIVED'])

export function normalizeCampaignStatus(status: string | null | undefined): string {
  return String(status || '').trim().toUpperCase()
}

export function isActiveCampaignStatus(status: string | null | undefined): boolean {
  const s = normalizeCampaignStatus(status)
  return s === 'ACTIVE' || s === 'WITH_ISSUES' || s === 'IN_PROCESS' || s === 'PENDING_REVIEW'
}

export function isPausedCampaignStatus(status: string | null | undefined): boolean {
  return normalizeCampaignStatus(status) === 'PAUSED'
}

/** Explicit webinar-only wording in the task brief — general "shut Binat campaigns" must stay broad. */
export function inferShutdownScopeFromText(text: string): CampaignShutdownScope {
  const webinarOnly =
    /(?:רק|בלבד|only)\s*(?:קמפיינ(?:ים|י)?\s*)?(?:webinar|וובינר|webinars)/i.test(text) ||
    /(?:webinar|וובינר|webinars)\s*(?:campaigns?\s*)?(?:only|בלבד|רק)/i.test(text) ||
    /קמפיינ(?:ים|י)\s*(?:webinar|וובינר)\s*בלבד/i.test(text)
  if (webinarOnly) {
    return { mode: 'name_includes', terms: ['webinar', 'וובינר', 'webinar'] }
  }
  return { mode: 'all_client_campaigns' }
}

export function selectCampaignsForShutdown(
  campaigns: ShutdownCampaignRow[],
  scope: CampaignShutdownScope,
): { checked: ShutdownCampaignRow[]; skipped_out_of_scope: ShutdownCampaignRow[]; scope_label: string } {
  const live = campaigns.filter((c) => !TERMINAL_STATUSES.has(normalizeCampaignStatus(c.effective_status)))

  if (scope.mode === 'all_client_campaigns') {
    return {
      checked: live,
      skipped_out_of_scope: campaigns.filter((c) => TERMINAL_STATUSES.has(normalizeCampaignStatus(c.effective_status))),
      scope_label: 'כל קמפיינים פעילים/מושהים של הלקוח (לא כולל ARCHIVED/DELETED)',
    }
  }

  const terms = scope.terms.map((t) => t.toLowerCase())
  const checked = live.filter((c) => {
    const name = String(c.campaign_name || '').toLowerCase()
    return terms.some((term) => name.includes(term))
  })
  const skipped_out_of_scope = live.filter((c) => !checked.some((x) => x.campaign_id === c.campaign_id))
  return {
    checked,
    skipped_out_of_scope,
    scope_label: `סינון שם: ${scope.terms.join(', ')}`,
  }
}

export function buildCampaignShutdownReport(result: Omit<CampaignShutdownRunResult, 'report'>): string {
  const lines = [
    `🕐 סיכום כיבוי/בדיקת קמפיינים — ${result.client_name}`,
    `היקף: ${result.scope.mode === 'all_client_campaigns' ? 'כל קמפייני הלקוח' : `שמות שמכילים: ${(result.scope as any).terms?.join(', ') || ''}`}`,
    `נבדקו: ${result.checked.length} | כבר PAUSED: ${result.already_paused.length} | הושהו עכשיו: ${result.newly_paused.length} | עדיין ACTIVE: ${result.still_active.length}`,
  ]
  if (result.skipped_out_of_scope.length > 0) {
    lines.push('', `דולגו (מחוץ להיקף / ארכיון): ${result.skipped_out_of_scope.length}`)
    for (const c of result.skipped_out_of_scope.slice(0, 8)) {
      lines.push(`• ${c.campaign_name} (${c.effective_status})`)
    }
    if (result.skipped_out_of_scope.length > 8) lines.push(`… ועוד ${result.skipped_out_of_scope.length - 8}`)
  }
  if (result.still_active.length > 0) {
    lines.push('', '⚠️ עדיין פעילים:')
    for (const c of result.still_active.slice(0, 10)) {
      lines.push(`• ${c.campaign_name}`)
    }
  }
  if (result.newly_paused.length > 0) {
    lines.push('', '✅ הושהו:')
    for (const c of result.newly_paused.slice(0, 10)) {
      lines.push(`• ${c.campaign_name}`)
    }
  }
  if (result.pause_errors.length > 0) {
    lines.push('', '❌ שגיאות השהיה:')
    for (const e of result.pause_errors.slice(0, 5)) {
      lines.push(`• ${e.campaign_name}: ${e.error}`)
    }
  }
  return lines.join('\n').slice(0, 3800)
}

function extractClientNameSearch(text: string): string | null {
  const m =
    text.match(/(?:לקוח|client)[:\s]+["']?([^"'\n,]+)/i) ||
    text.match(/\b(Binat|בינת)\b/i) ||
    text.match(/קמפיינ(?:ים|י)\s+(?:של\s+)?([^\n,]+?)(?:\s|$)/i)
  return m ? String(m[1]).trim() : null
}

export function looksLikeCampaignShutdownTask(title: string, description: string | null | undefined): boolean {
  const blob = `${title}\n${description || ''}`
  return /כיבוי|כב(?:ו|י)\s*(?:קמפיינ|campaign)|shutdown|verify.*campaign|בד(?:י|)ק.*קמפיינ|pause.*campaign/i.test(blob)
}

export function buildCampaignShutdownJobFromBrief(
  title: string,
  description: string | null | undefined,
  overrides: Partial<CampaignShutdownJob> = {},
): CampaignShutdownJob | null {
  if (!looksLikeCampaignShutdownTask(title, description || '')) return null
  const text = `${title}\n${description || ''}`
  return {
    client_name_search: overrides.client_id ? null : (overrides.client_name_search ?? extractClientNameSearch(text)),
    client_id: overrides.client_id ?? null,
    scope: overrides.scope ?? inferShutdownScopeFromText(text),
    auto_pause: overrides.auto_pause ?? /כיבוי|shutdown|pause|השה/i.test(text),
    notify_david: overrides.notify_david ?? true,
  }
}

export function extractCampaignShutdownJob(task: {
  title?: string | null
  description?: string | null
  result?: any
}): CampaignShutdownJob | null {
  const embedded = task?.result?.campaign_shutdown_job
  if (embedded && (embedded.client_id || embedded.client_name_search)) {
    return {
      client_id: embedded.client_id ?? null,
      client_name_search: embedded.client_name_search ?? null,
      scope: embedded.scope ?? { mode: 'all_client_campaigns' },
      auto_pause: embedded.auto_pause !== false,
      notify_david: embedded.notify_david !== false,
    }
  }
  return buildCampaignShutdownJobFromBrief(String(task.title || ''), task.description)
}
