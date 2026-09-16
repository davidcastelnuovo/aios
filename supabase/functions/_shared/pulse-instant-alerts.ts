/**
 * Instant WhatsApp alerts from campaign pulse snapshots.
 * Owner + assigned campaigners receive per-client alerts (deduped).
 */

import { isPulseDeliveryExcludedPhone } from './campaign-pulse.ts'
import { normalizeNotifyPhone } from './carmen-notify-target.ts'

export type PulseAlertRuleType = 'no_contact' | 'cpl_spike' | 'connection_lost'

export type PulseAlertRules = {
  instant_wa_enabled?: boolean
  no_contact_enabled?: boolean
  no_contact_days?: number
  cpl_spike_enabled?: boolean
  cpl_spike_pct?: number
  disconnected_enabled?: boolean
}

export const DEFAULT_PULSE_ALERT_RULES: PulseAlertRules = {
  instant_wa_enabled: true,
  no_contact_enabled: true,
  no_contact_days: 14,
  cpl_spike_enabled: true,
  cpl_spike_pct: 50,
  disconnected_enabled: true,
}

export type PulseInstantAlertCandidate = {
  client_id: string
  client_name: string
  rule_type: PulseAlertRuleType
  message: string
}

export type PulseSnapshotAlertInput = {
  client_id: string
  client_name?: string | null
  status?: string | null
  cpl_change_pct?: number | null
  flags?: string[] | null
  last_client_call_at?: string | null
  campaign_goal_mode?: string | null
  lead_goal_status?: string | null
  ecommerce_goal_status?: string | null
}

type CriticalIssueLike = {
  clientId: string
  clientName?: string | null
  alertType?: string | null
  campaignName?: string | null
}

type QueueWhatsApp = (
  message: string,
  chatId: string | null,
) => Promise<boolean>

const RULE_THROTTLE_HOURS: Record<PulseAlertRuleType, number> = {
  no_contact: 7 * 24,
  cpl_spike: 7 * 24,
  connection_lost: 24,
}

export function parsePulseAlertRules(raw: unknown): PulseAlertRules {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_PULSE_ALERT_RULES }
  const input = raw as Record<string, unknown>
  return {
    instant_wa_enabled: input.instant_wa_enabled !== false,
    no_contact_enabled: input.no_contact_enabled !== false,
    no_contact_days: Math.max(1, Number(input.no_contact_days) || DEFAULT_PULSE_ALERT_RULES.no_contact_days!),
    cpl_spike_enabled: input.cpl_spike_enabled !== false,
    cpl_spike_pct: Math.max(1, Number(input.cpl_spike_pct) || DEFAULT_PULSE_ALERT_RULES.cpl_spike_pct!),
    disconnected_enabled: input.disconnected_enabled !== false,
  }
}

function flagList(flags: string[] | null | undefined): string[] {
  return Array.isArray(flags) ? flags.filter(Boolean) : []
}

export function evaluatePulseInstantAlerts(
  snapshots: PulseSnapshotAlertInput[],
  criticalIssues: CriticalIssueLike[],
  rulesInput: unknown,
  nowMs = Date.now(),
): PulseInstantAlertCandidate[] {
  const rules = parsePulseAlertRules(rulesInput)
  if (!rules.instant_wa_enabled) return []

  const candidates: PulseInstantAlertCandidate[] = []
  const criticalByClient = new Map<string, CriticalIssueLike[]>()
  for (const issue of criticalIssues) {
    const list = criticalByClient.get(issue.clientId) || []
    list.push(issue)
    criticalByClient.set(issue.clientId, list)
  }

  for (const snapshot of snapshots) {
    const clientName = snapshot.client_name?.trim() || 'לקוח'
    const flags = flagList(snapshot.flags)

    if (rules.no_contact_enabled) {
      const days = rules.no_contact_days ?? 14
      const staleMs = days * 24 * 60 * 60 * 1000
      const lastContact = snapshot.last_client_call_at
        ? new Date(snapshot.last_client_call_at).getTime()
        : Number.NaN
      const missing = Number.isNaN(lastContact)
      const stale = !missing && nowMs - lastContact > staleMs
      if (missing || stale) {
        candidates.push({
          client_id: snapshot.client_id,
          client_name: clientName,
          rule_type: 'no_contact',
          message: [
            '🟡 *התראת דופק — אין עדכון קשר*',
            `לקוח: ${clientName}`,
            missing
              ? `לא תועדה שיחה/פגישה ב-${days} הימים האחרונים`
              : `עדכון קשר אחרון: ${new Date(lastContact).toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem' })}`,
            '',
            'AIOS → דשבורד דופק',
          ].join('\n'),
        })
      }
    }

    if (rules.cpl_spike_enabled) {
      const threshold = rules.cpl_spike_pct ?? 50
      const change = snapshot.cpl_change_pct
      if (change !== null && change !== undefined && Number(change) >= threshold) {
        candidates.push({
          client_id: snapshot.client_id,
          client_name: clientName,
          rule_type: 'cpl_spike',
          message: [
            '🔴 *התראת דופק — עליית CPL*',
            `לקוח: ${clientName}`,
            `CPL עלה ב-${Math.round(Number(change) * 10) / 10}% לעומת השבוע הקודם`,
            '',
            'AIOS → דשבורד דופק',
          ].join('\n'),
        })
      }
    }

    if (rules.disconnected_enabled) {
      const connectionFlags = flags.filter((flag) =>
        flag.includes('אין טבלת קמפיין')
        || flag.includes('סנכרון ישן')
        || flag.includes('קמפיין נעצר')
        || flag.includes('קמפיינים נעצרו'),
      )
      const statusNoData = snapshot.status === 'no_data'
        || snapshot.lead_goal_status === 'no_data'
        || snapshot.ecommerce_goal_status === 'no_data'
      const critical = criticalByClient.get(snapshot.client_id) || []
      const criticalLabels = critical.map((issue) => {
        if (issue.alertType === 'campaign_stopped') return 'קמפיין הושהה/נעצר'
        if (issue.alertType === 'ad_disapproved') return 'מודעה לא מאושרת'
        return issue.alertType || 'בעיית קמפיין'
      })

      const hasConnectionIssue = connectionFlags.length > 0 || criticalLabels.length > 0
        || (statusNoData && flags.some((flag) => flag.includes('אין טבלת')))

      if (hasConnectionIssue) {
        const detail = [
          ...connectionFlags.slice(0, 2),
          ...criticalLabels.slice(0, 2),
        ].filter(Boolean)
        candidates.push({
          client_id: snapshot.client_id,
          client_name: clientName,
          rule_type: 'connection_lost',
          message: [
            '🔴 *התראת דופק — חיבור/קמפיין*',
            `לקוח: ${clientName}`,
            detail.length ? detail.join(' · ') : 'דוח מנותק / חשבון לא פעיל',
            '',
            'AIOS → דשבורד דופק',
          ].join('\n'),
        })
      }
    }
  }

  return candidates
}

async function wasAlertSentRecently(
  supabase: any,
  tenantId: string,
  clientId: string,
  ruleType: PulseAlertRuleType,
  throttleHours: number,
): Promise<boolean> {
  const since = new Date(Date.now() - throttleHours * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('pulse_instant_alert_log')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('client_id', clientId)
    .eq('rule_type', ruleType)
    .gte('sent_at', since)
    .limit(1)
  if (error) {
    console.warn('[pulse-instant-alerts] dedupe lookup failed', error.message)
    return false
  }
  return (data?.length || 0) > 0
}

async function resolveInstantAlertRecipients(
  supabase: any,
  tenantId: string,
  clientId: string,
  pulsePhone: string | null | undefined,
  tenantSlug?: string | null,
): Promise<Array<{ phone: string; label: string }>> {
  const recipients = new Map<string, string>()

  const pulse = normalizeNotifyPhone(pulsePhone)
  if (pulse && !isPulseDeliveryExcludedPhone(pulse, tenantSlug)) {
    recipients.set(pulse, 'owner')
  }

  const { data: managers } = await supabase
    .from('tenant_users')
    .select('user_id, role')
    .eq('tenant_id', tenantId)
    .in('role', ['owner', 'admin', 'agency_owner', 'agency_manager'])
  const managerIds = (managers || []).map((row: any) => row.user_id).filter(Boolean)
  if (managerIds.length) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, phone, full_name')
      .in('id', managerIds)
    for (const profile of profiles || []) {
      const phone = normalizeNotifyPhone(profile.phone)
      if (!phone || isPulseDeliveryExcludedPhone(phone, tenantSlug)) continue
      recipients.set(phone, profile.full_name || 'manager')
    }
  }

  const { data: links } = await supabase
    .from('client_team')
    .select('campaigner_id')
    .eq('client_id', clientId)
  const campaignerIds = Array.from(new Set((links || []).map((row: any) => row.campaigner_id).filter(Boolean)))
  if (campaignerIds.length) {
    const { data: campaigners } = await supabase
      .from('campaigners')
      .select('id, full_name, phone, active')
      .in('id', campaignerIds)
      .eq('active', true)
    for (const campaigner of campaigners || []) {
      const phone = normalizeNotifyPhone(campaigner.phone)
      if (!phone || isPulseDeliveryExcludedPhone(phone, tenantSlug)) continue
      recipients.set(phone, campaigner.full_name || 'campaigner')
    }
  }

  return Array.from(recipients.entries()).map(([phone, label]) => ({ phone, label }))
}

export async function deliverInstantPulseAlerts(input: {
  supabase: any
  tenantId: string
  tenantSlug?: string | null
  pulsePhone?: string | null
  snapshots: PulseSnapshotAlertInput[]
  criticalIssues: CriticalIssueLike[]
  rules: unknown
  queueWhatsApp: QueueWhatsApp
}): Promise<{ sent: number; skipped: number; candidates: number }> {
  const candidates = evaluatePulseInstantAlerts(
    input.snapshots,
    input.criticalIssues,
    input.rules,
  )
  if (!candidates.length) return { sent: 0, skipped: 0, candidates: 0 }

  let sent = 0
  let skipped = 0

  for (const candidate of candidates) {
    const throttleHours = RULE_THROTTLE_HOURS[candidate.rule_type]
    const recentlySent = await wasAlertSentRecently(
      input.supabase,
      input.tenantId,
      candidate.client_id,
      candidate.rule_type,
      throttleHours,
    )
    if (recentlySent) {
      skipped += 1
      continue
    }

    const recipients = await resolveInstantAlertRecipients(
      input.supabase,
      input.tenantId,
      candidate.client_id,
      input.pulsePhone,
      input.tenantSlug,
    )
    if (!recipients.length) {
      skipped += 1
      continue
    }

    let delivered = false
    for (const recipient of recipients) {
      const queued = await input.queueWhatsApp(candidate.message, recipient.phone)
      if (queued) delivered = true
    }
    if (delivered) {
      sent += 1
      await input.supabase.from('pulse_instant_alert_log').insert({
        tenant_id: input.tenantId,
        client_id: candidate.client_id,
        rule_type: candidate.rule_type,
        message: candidate.message,
        recipient_phone: recipients.map((row) => row.phone).join(','),
      })
    } else {
      skipped += 1
    }
  }

  return { sent, skipped, candidates: candidates.length }
}
