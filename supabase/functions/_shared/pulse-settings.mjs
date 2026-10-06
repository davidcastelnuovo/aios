// Keep snapshot calculation available during a rolling schema deployment.
const BASE_COLUMNS = 'tenant_id, campaign_pulse_enabled, campaign_pulse_last_sent_at, campaign_pulse_phone, campaign_pulse_deliver_to_campaigners, campaign_pulse_deliver_to_team_managers, campaign_pulse_preview_phone'

export async function loadPulseSettings(supabase, tenantId) {
  const read = (columns) => {
    let query = supabase.from('tenant_heartbeat_settings').select(columns)
    if (tenantId) query = query.eq('tenant_id', tenantId)
    return query
  }
  const current = await read(`${BASE_COLUMNS}, pulse_alert_rules`)
  const missingRules = ['42703', 'PGRST204'].includes(current.error?.code)
    && /\bpulse_alert_rules\b/.test(current.error?.message || '')
  if (!missingRules) return { ...current, legacySchema: false }
  const legacy = await read(BASE_COLUMNS)
  return {
    ...legacy,
    // Missing configuration must not opt customers into instant messages.
    data: legacy.data?.map(row => ({ ...row, pulse_alert_rules: { instant_wa_enabled: false } })) ?? null,
    legacySchema: true,
  }
}
