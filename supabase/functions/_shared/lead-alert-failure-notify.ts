import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'

export const MARKETING_CAPTAIN_TENANT_ID = '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019'

export type LeadAlertFailureRow = {
  automation_log_id: string
  tenant_id: string
  client_phone?: string | null
  lead_name?: string | null
  client_name?: string | null
  error_message: string
}

export function isLeadAlertSendWhatsappFailure(
  triggerActionType: string | null | undefined,
  failedSteps: Array<{ action_type?: string }> | undefined,
  payload?: Record<string, unknown> | null,
): boolean {
  const sendFailed = Array.isArray(failedSteps)
    && failedSteps.some((step) => step?.action_type === 'send_whatsapp')
  if (!sendFailed) return false
  if (triggerActionType === 'inbound_webhook_lead') return true
  // Make/Webhook lead alerts carry client_phone + lead identity even when trigger
  // metadata is unavailable at log time.
  const clientPhone = payload?.client_phone ?? payload?.recipient_phone
  const leadName = payload?.lead_name ?? payload?.contact_name
  return Boolean(clientPhone && leadName)
}

export function formatLeadAlertFailureMessage(rows: LeadAlertFailureRow[]): string {
  if (rows.length === 1) {
    const row = rows[0]
    return [
      '🚨 *התראת ליד לא נשלחה* (Marketing Captain / ManyChat)',
      '',
      `ליד: *${row.lead_name || '—'}*`,
      `נמען: ${row.client_phone || '—'}${row.client_name ? ` (${row.client_name})` : ''}`,
      `שגיאה: ${row.error_message}`,
      '',
      'בדוק: Automations → היסטוריית ריצות → «התראת ליד ללקוח מ-Make / Webhook»',
    ].join('\n')
  }

  const lines = [
    `🚨 *${rows.length} התראות ליד לא נשלחו* (Marketing Captain / ManyChat)`,
    '',
  ]
  for (const row of rows.slice(0, 8)) {
    lines.push(
      `• *${row.lead_name || '—'}* → ${row.client_phone || '—'}${row.client_name ? ` (${row.client_name})` : ''}`,
      `  ${row.error_message}`,
    )
  }
  if (rows.length > 8) {
    lines.push(`… ועוד ${rows.length - 8}`)
  }
  lines.push('', 'בדוק: Automations → היסטוריית ריצות')
  return lines.join('\n')
}

export async function queueLeadAlertFailureNotification(
  supabase: SupabaseClient,
  row: LeadAlertFailureRow,
): Promise<void> {
  if (row.tenant_id !== MARKETING_CAPTAIN_TENANT_ID) return

  const { error } = await supabase
    .from('lead_alert_failure_notifications')
    .upsert({
      automation_log_id: row.automation_log_id,
      tenant_id: row.tenant_id,
      client_phone: row.client_phone ?? null,
      lead_name: row.lead_name ?? null,
      client_name: row.client_name ?? null,
      error_message: row.error_message,
    }, { onConflict: 'automation_log_id', ignoreDuplicates: true })

  if (error) {
    console.error('[lead-alert-failure] queue failed:', error.message)
  }
}

export async function deliverPendingLeadAlertFailureNotifications(
  supabase: SupabaseClient,
  opts?: { maxRows?: number; throttleMinutes?: number },
): Promise<{ delivered: number; skipped: string | null }> {
  const maxRows = opts?.maxRows ?? 20
  const throttleMinutes = opts?.throttleMinutes ?? 15

  const { data: pending, error: pendingError } = await supabase
    .from('lead_alert_failure_notifications')
    .select('automation_log_id, tenant_id, client_phone, lead_name, client_name, error_message, created_at')
    .eq('tenant_id', MARKETING_CAPTAIN_TENANT_ID)
    .is('notified_at', null)
    .order('created_at', { ascending: true })
    .limit(maxRows)

  if (pendingError) {
    console.error('[lead-alert-failure] pending query failed:', pendingError.message)
    return { delivered: 0, skipped: pendingError.message }
  }
  if (!pending?.length) return { delivered: 0, skipped: null }

  const since = new Date(Date.now() - throttleMinutes * 60 * 1000).toISOString()
  const { data: recent } = await supabase
    .from('lead_alert_failure_notifications')
    .select('id')
    .eq('tenant_id', MARKETING_CAPTAIN_TENANT_ID)
    .not('notified_at', 'is', null)
    .gte('notified_at', since)
    .limit(1)

  if (recent?.length) {
    return { delivered: 0, skipped: 'throttled' }
  }

  const message = formatLeadAlertFailureMessage(pending as LeadAlertFailureRow[])
  const { error: notifyError } = await supabase.rpc('claude_notify_david', {
    p_message: message,
    p_tenant: MARKETING_CAPTAIN_TENANT_ID,
  })

  if (notifyError) {
    console.error('[lead-alert-failure] claude_notify_david failed:', notifyError.message)
    return { delivered: 0, skipped: notifyError.message }
  }

  const ids = pending.map((row) => row.automation_log_id)
  const { error: markError } = await supabase
    .from('lead_alert_failure_notifications')
    .update({ notified_at: new Date().toISOString() })
    .in('automation_log_id', ids)
    .is('notified_at', null)

  if (markError) {
    console.error('[lead-alert-failure] mark notified failed:', markError.message)
  }

  return { delivered: pending.length, skipped: null }
}
