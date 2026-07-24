/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const round = (value: number | null, digits = 2) =>
  value === null ? null : Math.round(value * 10 ** digits) / 10 ** digits

function buildDigest(rows: any[]): string {
  const count = (status: string) => rows.filter((row) => row.status === status).length
  const statusLabel: Record<string, string> = {
    healthy: 'תקין',
    warning: 'אזהרה',
    critical: 'קריטי',
    no_data: 'אין נתונים',
  }
  const lines = [
    'עדכון קמפיינים אוטומטי',
    `נבדקו ${rows.length} לקוחות פעילים: ${count('healthy')} תקינים, ${count('warning')} דורשים תשומת לב, ${count('critical')} קריטיים, ${count('no_data')} ללא נתונים.`,
  ]
  const agencies = new Map<string, any[]>()
  for (const row of rows) {
    const agency = row.agency_name || 'ללא סוכנות'
    agencies.set(agency, [...(agencies.get(agency) || []), row])
  }
  for (const [agency, agencyRows] of agencies) {
    lines.push('', `*${agency}*`, 'לקוח | מדד 7 ימים | מצב')
    for (const row of agencyRows) {
      const metric = row.is_ecommerce
        ? `ROAS ${row.roas_7d ?? '—'}`
        : `CPL ₪${row.cpl_7d ?? '—'}`
      lines.push(`${row.client_name} | ${metric} | ${statusLabel[row.status] || row.status}`)
      if ((row.flags || []).length) lines.push(`↳ ${(row.flags || []).join(', ')}`)
    }
  }
  lines.push('מקור: הנתונים המסונכרנים ב-AIOS. ללא הפעלת כרמן וללא קריאת API נוספת.')
  return lines.join('\n')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok')
  const auth = req.headers.get('authorization')
  const cronSecret = Deno.env.get('CAMPAIGN_PULSE_CRON_SECRET')
  if (auth !== `Bearer ${SERVICE_KEY}` && (!cronSecret || auth !== `Bearer ${cronSecret}`)) {
    return json({ error: 'Unauthorized' }, 401)
  }
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
  let body: any = {}
  try { body = await req.json() } catch { /* empty cron body */ }
  const deliveryRequested = body.deliver !== false
  let settingsQuery = supabase.from('tenant_heartbeat_settings')
    .select('tenant_id, campaign_pulse_enabled, campaign_pulse_last_sent_at')
  if (body.tenant_id) settingsQuery = settingsQuery.eq('tenant_id', body.tenant_id)
  const { data: settings, error: settingsError } = await settingsQuery
  if (settingsError) return json({ error: settingsError.message }, 500)

  const results: any[] = []
  for (const setting of settings || []) {
    const started = Date.now()
    const tenantId = setting.tenant_id
    const [{ data: ownedAgencies, error: ownedAgenciesError }, { data: sharedAgencies, error: sharedAgenciesError }] =
      await Promise.all([
        supabase.from('agencies').select('id').eq('tenant_id', tenantId),
        supabase.from('agency_tenant_access').select('agency_id').eq('accessing_tenant_id', tenantId),
      ])
    if (ownedAgenciesError || sharedAgenciesError) {
      results.push({ tenant_id: tenantId, error: ownedAgenciesError?.message || sharedAgenciesError?.message })
      continue
    }
    const agencyIds = Array.from(new Set([
      ...(ownedAgencies || []).map((agency: any) => agency.id),
      ...(sharedAgencies || []).map((agency: any) => agency.agency_id),
    ]))
    const { data: clients, error: clientsError } = await supabase.from('clients')
      .select('id, name, tenant_id, agency_id, is_ecommerce, agencies(name)')
      .in('agency_id', agencyIds.length ? agencyIds : ['00000000-0000-0000-0000-000000000000'])
      .eq('status', 'active').order('name')
    if (clientsError) { results.push({ tenant_id: tenantId, error: clientsError.message }); continue }
    const clientIds = (clients || []).map((client: any) => client.id)
    const tableResult = clientIds.length
      ? await supabase.rpc('find_campaign_tables', { p_client_ids: clientIds })
      : { data: [], error: null }
    if (tableResult.error) { results.push({ tenant_id: tenantId, error: tableResult.error.message }); continue }
    const tablesByClient = new Map<string, string[]>()
    for (const table of tableResult.data || []) {
      const ids = tablesByClient.get(table.client_id) || []
      ids.push(table.table_id); tablesByClient.set(table.client_id, ids)
    }

    const now = new Date()
    const d7 = new Date(now); d7.setDate(d7.getDate() - 7)
    const d14 = new Date(now); d14.setDate(d14.getDate() - 14)
    const d30 = new Date(now); d30.setDate(d30.getDate() - 30)
    const d7Str = d7.toISOString().slice(0, 10)
    const d14Str = d14.toISOString().slice(0, 10)
    const d30Str = d30.toISOString().slice(0, 10)
    const snapshots: any[] = []
    for (const client of clients || []) {
      const tableIds = tablesByClient.get(client.id) || []
      let records: any[] = []
      if (tableIds.length) {
        const response = await supabase.from('crm_records').select('data')
          .in('table_id', tableIds)
        records = response.data || []
      }
      const recent = records.filter((row: any) => row.data?.date && row.data.date >= d30Str)
      const current = recent.filter((row: any) => row.data.date >= d7Str)
      const previous = recent.filter((row: any) => row.data.date >= d14Str && row.data.date < d7Str)
      const sum = (rows: any[], fields: string[]) =>
        rows.reduce((total, row) => {
          const field = fields.find((candidate) => row.data?.[candidate] !== undefined && row.data?.[candidate] !== null)
          return total + (field ? Number(row.data[field]) || 0 : 0)
        }, 0)
      const spend7 = sum(current, ['spend', 'cost'])
      const leads7 = sum(current, ['leads', 'conversions', 'all_conversions'])
      const previousSpend = sum(previous, ['spend', 'cost'])
      const previousLeads = sum(previous, ['leads', 'conversions', 'all_conversions'])
      const cpl7 = leads7 > 0 ? spend7 / leads7 : null
      const previousCpl = previousLeads > 0 ? previousSpend / previousLeads : null
      const cplChange = cpl7 !== null && previousCpl ? ((cpl7 - previousCpl) / previousCpl) * 100 : null
      const purchases = sum(current, ['purchases'])
      const revenue = sum(current, ['purchase_value', 'conversions_value', 'revenue'])
      const roas = spend7 > 0 ? revenue / spend7 : null
      const freshest = recent.map((row: any) => row.data?.date).filter(Boolean).sort().reverse()[0] || null
      const flags: string[] = []
      let status: 'healthy' | 'warning' | 'critical' | 'no_data' = 'healthy'
      if (!tableIds.length || recent.length === 0) {
        status = 'no_data'; flags.push(!tableIds.length ? 'אין טבלת קמפיין מחוברת' : 'אין נתונים ב-30 הימים האחרונים')
      } else if (client.is_ecommerce) {
        if (spend7 > 0 && purchases === 0) { status = 'critical'; flags.push('הוצאה ללא רכישות') }
        else if (roas !== null && roas < 1) { status = 'critical'; flags.push('ROAS נמוך מ-1') }
        else if (roas !== null && roas < 1.5) { status = 'warning'; flags.push('ROAS נמוך') }
      } else {
        if (spend7 > 0 && leads7 === 0) { status = 'critical'; flags.push('הוצאה ללא לידים') }
        else if (cplChange !== null && cplChange > 25) { status = 'warning'; flags.push(`CPL עלה ב-${round(cplChange, 1)}%`) }
      }
      snapshots.push({
        tenant_id: tenantId, agency_id: client.agency_id, client_id: client.id,
        calculated_at: now.toISOString(), data_fresh_through: freshest, status,
        is_ecommerce: !!client.is_ecommerce, spend_7d: round(spend7), leads_7d: round(leads7),
        cpl_7d: round(cpl7), cpl_change_pct: round(cplChange, 1), purchases_7d: round(purchases),
        revenue_7d: round(revenue), roas_7d: round(roas), flags, source: 'synced_crm',
        client_name: client.name, agency_name: (client.agencies as any)?.name || null,
      })
    }
    const currentClientIds = snapshots.map((snapshot) => snapshot.client_id)
    let staleSnapshotsQuery = supabase.from('campaign_pulse_snapshots')
      .delete()
      .eq('tenant_id', tenantId)
    if (currentClientIds.length) {
      staleSnapshotsQuery = staleSnapshotsQuery.not('client_id', 'in', `(${currentClientIds.join(',')})`)
    }
    const { error: staleSnapshotsError } = await staleSnapshotsQuery
    if (staleSnapshotsError) {
      results.push({ tenant_id: tenantId, error: staleSnapshotsError.message })
      continue
    }
    if (snapshots.length) {
      const rows = snapshots.map(({ client_name: _c, agency_name: _a, ...row }) => row)
      const { error } = await supabase.from('campaign_pulse_snapshots')
        .upsert(rows, { onConflict: 'tenant_id,client_id' })
      if (error) { results.push({ tenant_id: tenantId, error: error.message }); continue }
    }
    const digest = buildDigest(snapshots)
    let sent = false
    let deliveryClaimed = false
    if (deliveryRequested && setting.campaign_pulse_enabled) {
      const claim = await supabase.rpc('claim_campaign_pulse_delivery', { p_tenant_id: tenantId })
      deliveryClaimed = claim.data === true && !claim.error
      if (claim.error) console.error('Failed to claim campaign pulse delivery:', claim.error.message)
    }
    if (deliveryClaimed) {
      // Reuse the tenant's existing "Carmen Direct" automation and its most
      // recent direct chat. This keeps the sender, recipient and provider
      // identical to Carmen's normal replies (Manus WA or Green API).
      const delivery = await supabase.rpc('claude_notify_david', {
        p_message: digest,
        p_tenant: tenantId,
      })
      sent = !delivery.error && delivery.data?.queued === true
      if (!sent) {
        console.error('Failed to queue deterministic campaign pulse via Carmen Direct:', delivery.error?.message)
        await supabase.from('tenant_heartbeat_settings')
          .update({ campaign_pulse_last_sent_at: null }).eq('tenant_id', tenantId)
      }
    }
    await supabase.from('heartbeat_logs').insert({
      tenant_id: tenantId, tasks_reviewed: snapshots.length,
      actions_taken: [{ type: 'deterministic_campaign_pulse', sent, ai_used: false, external_api_calls: 0 }],
      summary: digest, duration_ms: Date.now() - started,
    })
    results.push({
      tenant_id: tenantId,
      clients: snapshots.length,
      sent,
      delivery_channel: 'carmen_direct',
      delivery_requested: deliveryRequested,
      skipped_duplicate_delivery: deliveryRequested && setting.campaign_pulse_enabled && !deliveryClaimed,
      ai_used: false,
      external_api_calls: 0,
    })
  }
  return json({ success: true, results })
})
