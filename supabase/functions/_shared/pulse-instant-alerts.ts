/**
 * Instant WhatsApp alerts from campaign pulse snapshots.
 * Scoped owner + responsible team managers receive per-campaign alerts (deduped).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { isPulseDeliveryExcludedPhone } from './campaign-pulse.ts'
import { normalizeNotifyPhone } from './carmen-notify-target.ts'

export type PulseAlertRuleType = 'no_contact' | 'cpl_spike' | 'connection_lost' | 'campaign_exception'

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
  campaign_key?: string | null
  fingerprint?: string | null
  severity_score?: number | null
  evidence?: Record<string, unknown>
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
  agency_id?: string | null
  campaign_breakdown?: Array<{
    campaign_key?: string | null
    campaign_name?: string | null
    goal?: string | null
    status_reason?: string | null
    alert_eligible?: boolean | null
    target_kind?: string | null
    target_value?: number | null
    efficiency_3d?: number | null
    efficiency_7d?: number | null
    trend_3d_pct?: number | null
    trend_7d_pct?: number | null
    data_fresh_through?: string | null
    last_change_at?: string | null
  }> | null
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

type AnalyzeException = (
  candidate: PulseInstantAlertCandidate,
) => Promise<{ confirmed: boolean; summary?: string | null; recommended_check?: string | null } | null>

export function confirmPulseExceptionCandidate(
  candidate: PulseInstantAlertCandidate,
  analysis: { confirmed: boolean; summary?: string | null; recommended_check?: string | null } | null,
): PulseInstantAlertCandidate | null {
  if (!analysis?.confirmed) return null
  return {
    ...candidate,
    message: [
      candidate.message,
      analysis.summary ? `\nאימות AI: ${analysis.summary}` : '',
      analysis.recommended_check ? `בדיקה מומלצת: ${analysis.recommended_check}` : '',
    ].filter(Boolean).join('\n'),
    evidence: {
      ...(candidate.evidence || {}),
      ai_confirmation: analysis,
    },
  }
}

const RULE_THROTTLE_HOURS: Record<PulseAlertRuleType, number> = {
  no_contact: 7 * 24,
  cpl_spike: 7 * 24,
  connection_lost: 24,
  campaign_exception: 7 * 24,
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
    const campaignBreakdown = Array.isArray(snapshot.campaign_breakdown)
      ? snapshot.campaign_breakdown
      : []

    for (const campaign of campaignBreakdown) {
      if (campaign.alert_eligible !== true || !campaign.campaign_key) continue
      const target = campaign.target_value === null || campaign.target_value === undefined
        ? 'אין יעד מאושר'
        : `${String(campaign.target_kind || 'יעד').toUpperCase()} ${campaign.target_value}`
      const severity = Math.max(
        1,
        Math.abs(Number(campaign.trend_3d_pct) || 0),
        Math.abs(Number(campaign.trend_7d_pct) || 0),
      )
      const fingerprint = [
        campaign.campaign_key,
        campaign.status_reason || 'campaign_exception',
        campaign.target_kind || 'no_target',
        campaign.target_value ?? 'none',
      ].join(':')
      const evidence = {
        goal: campaign.goal || null,
        target_kind: campaign.target_kind || null,
        target_value: campaign.target_value ?? null,
        efficiency_3d: campaign.efficiency_3d ?? null,
        efficiency_7d: campaign.efficiency_7d ?? null,
        trend_3d_pct: campaign.trend_3d_pct ?? null,
        trend_7d_pct: campaign.trend_7d_pct ?? null,
        data_fresh_through: campaign.data_fresh_through ?? null,
        last_change_at: campaign.last_change_at ?? null,
      }
      candidates.push({
        client_id: snapshot.client_id,
        client_name: clientName,
        rule_type: 'campaign_exception',
        campaign_key: campaign.campaign_key,
        fingerprint,
        severity_score: severity,
        evidence,
        message: [
          '🔴 *התראת דופק — חריגת קמפיין מאומתת*',
          `לקוח: ${clientName}`,
          `קמפיין: ${campaign.campaign_name || campaign.campaign_key}`,
          `קטגוריה: ${campaign.goal || 'לא מסווג'}`,
          `סיבה: ${campaign.status_reason || 'חריגה מתמשכת'}`,
          `יעד: ${target}`,
          `3 ימים: ${campaign.efficiency_3d ?? 'חסר'} · 7 ימים: ${campaign.efficiency_7d ?? 'חסר'}`,
          `שינוי אחרון: ${campaign.last_change_at || 'לא זמין'}`,
          `נתונים עד: ${campaign.data_fresh_through || 'לא זמין'}`,
          '',
          'בדיקה מומלצת: לאמת יעד, אירוע אופטימיזציה ושינויים אחרונים לפני פעולה.',
          'AIOS → דשבורד דופק',
        ].join('\n'),
      })
    }

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

    // Legacy snapshots do not have campaign evidence. Once campaign_breakdown
    // exists, target-aware campaign exceptions replace raw CPL-spike alerts.
    if (rules.cpl_spike_enabled && campaignBreakdown.length === 0) {
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

async function latestAlertDelivery(
  supabase: any,
  tenantId: string,
  clientId: string,
  ruleType: PulseAlertRuleType,
  throttleHours: number,
  campaignKey?: string | null,
): Promise<{ fingerprint?: string | null; severity_score?: number | null } | null> {
  const since = new Date(Date.now() - throttleHours * 60 * 60 * 1000).toISOString()
  let query = supabase
    .from('pulse_instant_alert_log')
    .select('fingerprint, severity_score')
    .eq('tenant_id', tenantId)
    .eq('client_id', clientId)
    .eq('rule_type', ruleType)
    .gte('sent_at', since)
    .order('sent_at', { ascending: false })
    .limit(1)
  if (campaignKey) query = query.eq('campaign_key', campaignKey)
  const { data, error } = await query
  if (error) {
    console.warn('[pulse-instant-alerts] dedupe lookup failed', error.message)
    return null
  }
  return data?.[0] || null
}

async function resolveInstantAlertRecipients(
  supabase: any,
  tenantId: string,
  clientId: string,
  agencyId: string | null | undefined,
  pulsePhone: string | null | undefined,
  tenantSlug?: string | null,
): Promise<Array<{ phone: string; label: string }>> {
  const recipients = new Map<string, string>()

  const pulse = normalizeNotifyPhone(pulsePhone)
  if (pulse && !isPulseDeliveryExcludedPhone(pulse, tenantSlug)) {
    recipients.set(pulse, 'owner')
  }

  const { data: roles } = await supabase
    .from('user_roles')
    .select('user_id, role')
    .eq('tenant_id', tenantId)
    .in('role', ['owner', 'agency_owner', 'team_manager'])
  const ownerIds = (roles || [])
    .filter((row: any) => row.role === 'owner' || row.role === 'agency_owner')
    .map((row: any) => row.user_id)
    .filter(Boolean)
  let managerIds = (roles || [])
    .filter((row: any) => row.role === 'team_manager')
    .map((row: any) => row.user_id)
    .filter(Boolean)
  if (agencyId && managerIds.length) {
    const { data: managed } = await supabase
      .from('user_managed_agencies')
      .select('user_id')
      .eq('agency_id', agencyId)
      .in('user_id', managerIds)
    const allowed = new Set((managed || []).map((row: any) => row.user_id))
    managerIds = managerIds.filter((id: string) => allowed.has(id))
  }
  const recipientUserIds = Array.from(new Set([...ownerIds, ...managerIds]))
  if (recipientUserIds.length) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, campaigners ( phone )')
      .in('id', recipientUserIds)
    for (const profile of profiles || []) {
      const phone = normalizeNotifyPhone(profile.campaigners?.phone)
      if (!phone || isPulseDeliveryExcludedPhone(phone, tenantSlug)) continue
      recipients.set(phone, profile.full_name || 'manager')
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
  analyzeException?: AnalyzeException
}): Promise<{ sent: number; skipped: number; candidates: number; analyzed: number }> {
  const candidates = evaluatePulseInstantAlerts(
    input.snapshots,
    input.criticalIssues,
    input.rules,
  )
  if (!candidates.length) return { sent: 0, skipped: 0, candidates: 0, analyzed: 0 }

  let sent = 0
  let skipped = 0
  let analyzed = 0

  for (const candidate of candidates) {
    const throttleHours = RULE_THROTTLE_HOURS[candidate.rule_type]
    const previousDelivery = await latestAlertDelivery(
      input.supabase,
      input.tenantId,
      candidate.client_id,
      candidate.rule_type,
      throttleHours,
      candidate.campaign_key,
    )
    const sameFinding = previousDelivery
      && previousDelivery.fingerprint === candidate.fingerprint
    const materiallyWorse = previousDelivery
      && Number(candidate.severity_score || 0) > Number(previousDelivery.severity_score || 0) * 1.1
    if (previousDelivery && sameFinding && !materiallyWorse) {
      skipped += 1
      continue
    }

    if (candidate.rule_type === 'campaign_exception') {
      // AI is never used during collection or trend calculation. It receives
      // only a deterministic exception candidate and may veto the notification.
      if (!input.analyzeException) {
        skipped += 1
        continue
      }
      const analysis = await input.analyzeException(candidate)
      analyzed += 1
      const confirmed = confirmPulseExceptionCandidate(candidate, analysis)
      if (!confirmed) {
        skipped += 1
        continue
      }
      candidate.message = confirmed.message
      candidate.evidence = confirmed.evidence
    }

    const recipients = await resolveInstantAlertRecipients(
      input.supabase,
      input.tenantId,
      candidate.client_id,
      input.snapshots.find((snapshot) => snapshot.client_id === candidate.client_id)?.agency_id,
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
        campaign_key: candidate.campaign_key || null,
        fingerprint: candidate.fingerprint || null,
        severity_score: candidate.severity_score || null,
        evidence: candidate.evidence || {},
      })
    } else {
      skipped += 1
    }
  }

  return { sent, skipped, candidates: candidates.length, analyzed }
}
