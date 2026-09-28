/**
 * Deterministic client-retention ranking.
 * Uses the stored campaign pulse + CRM mood. No model, no outbound messages.
 */
import { CLIENT_CALL_STALE_MS } from './campaign-pulse.ts'

export const RETENTION_LIST_LIMIT = 25
export const RETENTION_DIGEST_NAME_LIMIT = 5
export const RETENTION_BATCH_LIMIT = 25

export type RetentionBand = 'act_now' | 'watch' | 'steady'
export type RetentionMood = 'happy' | 'wavering' | 'churn_risk'

export type RetentionClientInput = {
  client_id: string
  client_name: string
  mood_status?: string | null
  pulse_status?: string | null
  last_client_call_at?: string | null
  flags?: string[] | null
  has_campaign_snapshot?: boolean
  /** False when the snapshot has no call column yet — do not invent a stale call. */
  call_known?: boolean
}

export type RetentionItem = {
  client_id: string
  client_name: string
  band: Exclude<RetentionBand, 'steady'>
  reasons: string[]
  next_action: string
  suggested_mood: RetentionMood
}

const BAND_RANK: Record<RetentionItem['band'], number> = { act_now: 0, watch: 1 }

export function hasRetentionIntent(text: string): boolean {
  return /שימור|נטישה|churn|בריאות\s*לקוח|לקוחות\s*בסיכון|סיכון\s*נטישה/iu.test(String(text || ''))
}

export function isCallStale(lastCallAt: string | null | undefined, nowMs = Date.now()): boolean {
  if (!lastCallAt) return true
  const ts = new Date(lastCallAt).getTime()
  if (Number.isNaN(ts)) return true
  return nowMs - ts > CLIENT_CALL_STALE_MS
}

function hasStaleSyncFlag(flags: string[] | null | undefined): boolean {
  return (flags || []).some((flag) => /סנכרון ישן|stale/i.test(flag))
}

export function rankRetentionClient(
  client: RetentionClientInput,
  nowMs = Date.now(),
): RetentionItem | null {
  const mood = client.mood_status || null
  const pulse = client.pulse_status || null
  const reasons: string[] = []
  let band: RetentionItem['band'] | null = null

  if (mood === 'churn_risk') {
    band = 'act_now'
    reasons.push('מצב CRM: סיכון נטישה')
  }
  if (pulse === 'critical') {
    band = 'act_now'
    reasons.push('דופק קמפיין קריטי')
  }
  const campaignClient = client.has_campaign_snapshot === true && pulse !== 'no_data'
  if (campaignClient && client.call_known !== false && isCallStale(client.last_client_call_at, nowMs)) {
    band = 'act_now'
    reasons.push(client.last_client_call_at ? 'אין שיחת לקוח מתועדת 14 יום' : 'אין שיחת לקוח מתועדת')
  }

  if (!band && (mood === 'wavering' || mood === 'not_progressing')) {
    band = 'watch'
    reasons.push(mood === 'not_progressing' ? 'מצב CRM: לא מתקדם' : 'מצב CRM: מתלבט')
  }
  if (!band && pulse === 'warning') {
    band = 'watch'
    reasons.push('דופק קמפיין דורש תשומת לב')
  }
  if (!band && hasStaleSyncFlag(client.flags)) {
    band = 'watch'
    reasons.push('סנכרון קמפיין ישן')
  }
  if (!band) return null

  const suggested_mood: RetentionMood = band === 'act_now'
    ? (pulse === 'critical' || mood === 'churn_risk' ? 'churn_risk' : 'wavering')
    : 'wavering'

  const next_action = band === 'act_now'
    ? (reasons.some((reason) => reason.includes('שיחת לקוח')) && pulse !== 'critical' && mood !== 'churn_risk'
      ? 'לקבוע או לתעד שיחה. לא לשלוח הודעה ללקוח בלי אישור.'
      : 'שיחת שימור היום ועדכון יומן. לא לשלוח הודעה ללקוח בלי אישור.')
    : 'בדיקה עם הקמפיינר השבוע. לא לשלוח הודעה ללקוח בלי אישור.'

  return {
    client_id: client.client_id,
    client_name: client.client_name,
    band,
    reasons,
    next_action,
    suggested_mood,
  }
}

export function buildRetentionScan(clients: RetentionClientInput[], nowMs = Date.now()) {
  const ranked = clients
    .map((client) => rankRetentionClient(client, nowMs))
    .filter((item): item is RetentionItem => !!item)
    .sort((a, b) => BAND_RANK[a.band] - BAND_RANK[b.band] || a.client_name.localeCompare(b.client_name, 'he'))

  const actNow = ranked.filter((item) => item.band === 'act_now')
  const watch = ranked.filter((item) => item.band === 'watch')
  return {
    scanned: clients.length,
    act_now_count: actNow.length,
    watch_count: watch.length,
    steady_count: Math.max(0, clients.length - ranked.length),
    items: ranked.slice(0, RETENTION_LIST_LIMIT),
    truncated: ranked.length > RETENTION_LIST_LIMIT,
    whatsapp_digest: buildRetentionWhatsAppDigest({
      scanned: clients.length,
      actNow,
      watchCount: watch.length,
    }),
  }
}

export function buildRetentionWhatsAppDigest(input: {
  scanned: number
  actNow: Array<{ client_name: string }>
  watchCount: number
}): string {
  const names = input.actNow.slice(0, RETENTION_DIGEST_NAME_LIMIT).map((item) => item.client_name)
  const extra = input.actNow.length - names.length
  const lines = [
    '*דופק שימור*',
    `נסרקו ${input.scanned} לקוחות פעילים.`,
    `לטיפול עכשיו: ${input.actNow.length}`,
    `למעקב: ${input.watchCount}`,
  ]
  if (names.length) {
    lines.push(`לטיפול: ${names.join(', ')}${extra > 0 ? ` ועוד ${extra}` : ''}`)
  }
  lines.push('אין שליחה ללקוח — רק המלצה לצוות.')
  return lines.join('\n')
}
