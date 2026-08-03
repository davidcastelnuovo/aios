/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'
import {
  CAMPAIGN_TABLE_TYPES,
  classifyCampaignPulseStatus,
  clientCampaignServices as servicesFromClient,
  effectiveIsEcommerce,
  tableMatchesServices,
} from '../_shared/campaign-pulse.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const round = (value: number | null, digits = 2) =>
  value === null ? null : Math.round(value * 10 ** digits) / 10 ** digits

const META_GRAPH_VERSION = 'v21.0'
const META_ACTIVITY_OBJECTS = new Set(['CAMPAIGN', 'AD_SET', 'AD'])

function clientCampaignServices(client: any): Set<string> {
  return servicesFromClient(client?.services)
}

async function getMetaToken(supabase: any, tenantId: string): Promise<string | null> {
  let { data } = await supabase.from('tenant_integrations')
    .select('api_key, shared_from_integration_id')
    .eq('tenant_id', tenantId)
    .in('integration_type', ['facebook', 'facebook_lead_ads'])
    .eq('is_active', true)
    .limit(1).maybeSingle()
  if (data && !data.api_key && data.shared_from_integration_id) {
    const source = await supabase.from('tenant_integrations')
      .select('api_key').eq('id', data.shared_from_integration_id).eq('is_active', true).maybeSingle()
    if (source.data?.api_key) data = { ...data, api_key: source.data.api_key }
  }
  return data?.api_key || null
}

async function getLastMetaCampaignChange(
  token: string | null,
  adAccountId: string | null,
): Promise<{ at: string | null; type: string | null; actor: string | null; object: string | null; availability: string }> {
  if (!adAccountId) return { at: null, type: null, actor: null, object: null, availability: 'ad_account_not_connected' }
  if (!token) return { at: null, type: null, actor: null, object: null, availability: 'meta_token_unavailable' }
  try {
    const account = String(adAccountId).replace(/^act_/, '')
    const since = new Date(Date.now() - 30 * 86400000).toISOString()
    const params = new URLSearchParams({
      fields: 'event_time,date_time_in_timezone,event_type,translated_event_type,actor_name,object_id,object_name,object_type',
      add_children: 'true',
      since,
      limit: '100',
      access_token: token,
    })
    const response = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/act_${account}/activities?${params}`)
    const payload = await response.json()
    if (!response.ok || payload?.error || !Array.isArray(payload?.data)) {
      console.warn('[campaign-pulse] Meta activities unavailable', account, payload?.error?.code || response.status)
      return { at: null, type: null, actor: null, object: null, availability: 'meta_api_unavailable' }
    }
    const latest = payload.data
      .filter((activity: any) => META_ACTIVITY_OBJECTS.has(String(activity?.object_type || '').toUpperCase()))
      .sort((a: any, b: any) => new Date(b.event_time || b.date_time_in_timezone || 0).getTime() - new Date(a.event_time || a.date_time_in_timezone || 0).getTime())[0]
    if (!latest) return { at: null, type: null, actor: null, object: null, availability: 'no_campaign_change_in_30d' }
    return {
      at: latest.event_time || latest.date_time_in_timezone || null,
      type: latest.translated_event_type || latest.event_type || null,
      actor: latest.actor_name || null,
      object: latest.object_name || latest.object_id || null,
      availability: 'available',
    }
  } catch (error) {
    console.warn('[campaign-pulse] Meta activities error', error instanceof Error ? error.message : String(error))
    return { at: null, type: null, actor: null, object: null, availability: 'meta_api_unavailable' }
  }
}

const ONBOARDING_STATUS_LABELS: Record<string, string> = {
  research_meeting: 'פגישת מחקר',
  receiving_access: 'קבלת גישות',
  setup_and_content: 'הקמה ותוכן',
  campaign_live: 'הקמפיין עלה לאוויר',
}

function formatTaskDueDate(value: string | null): string {
  if (!value) return ''
  return `, יעד ${new Date(`${value}T12:00:00Z`).toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem' })}`
}

function buildDigest(rows: any[], onboardingClients: any[]): string {
  const count = (status: string) => rows.filter((row) => row.status === status).length
  const statusDisplay: Record<string, { icon: string; label: string; priority: number }> = {
    critical: { icon: '🔴', label: 'קריטי', priority: 0 },
    warning: { icon: '🟡', label: 'תשומת לב', priority: 1 },
    no_data: { icon: '🟡', label: 'תשומת לב', priority: 1 },
    healthy: { icon: '🟢', label: 'תקין', priority: 2 },
  }
  const lines = [
    '*עדכון קמפיינים אוטומטי*',
    `נבדקו ${rows.length} לקוחות פעילים: 🟢 ${count('healthy')} תקינים | 🟡 ${count('warning') + count('no_data')} דורשים תשומת לב | 🔴 ${count('critical')} קריטיים`,
  ]
  const agencies = new Map<string, any[]>()
  for (const row of rows) {
    const agency = row.agency_name || 'ללא סוכנות'
    agencies.set(agency, [...(agencies.get(agency) || []), row])
  }
  for (const [agency, agencyRows] of agencies) {
    lines.push('', `*${agency}*`)
    const sortedRows = [...agencyRows].sort((a, b) =>
      (statusDisplay[a.status]?.priority ?? 3) - (statusDisplay[b.status]?.priority ?? 3)
      || String(a.client_name).localeCompare(String(b.client_name), 'he')
    )
    for (const row of sortedRows) {
      const display = statusDisplay[row.status] || { icon: '🟡', label: 'תשומת לב' }
      const metric = row.is_ecommerce
        ? `ROAS ${row.roas_7d ?? '—'}`
        : `CPL ₪${row.cpl_7d ?? '—'}`
      const detail = (row.flags || []).length ? ` — ${(row.flags || []).join(', ')}` : ''
      const metaChange = row.meta_change_availability === 'not_applicable'
        ? ''
        : row.last_meta_change_at
          ? ` — שינוי Meta אחרון: ${new Date(row.last_meta_change_at).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })}`
          : ` — שינוי Meta אחרון: ${row.meta_change_availability === 'no_campaign_change_in_30d' ? 'לא נמצא ב-30 יום' : 'לא זמין'}`
      lines.push(`${display.icon} *${row.client_name}* — ${display.label} — ${metric}${metaChange}${detail}`)
    }
  }
  lines.push('', '*לקוחות בקליטה*')
  if (!onboardingClients.length) {
    lines.push('אין כרגע לקוחות בקליטה.')
  } else {
    const onboardingAgencies = new Map<string, any[]>()
    for (const client of onboardingClients) {
      const agency = client.agency_name || 'ללא סוכנות'
      onboardingAgencies.set(agency, [...(onboardingAgencies.get(agency) || []), client])
    }
    for (const [agency, clients] of onboardingAgencies) {
      lines.push(`_${agency}_`)
      for (const client of [...clients].sort((a, b) =>
        String(a.client_name).localeCompare(String(b.client_name), 'he')
      )) {
        const stage = ONBOARDING_STATUS_LABELS[client.onboarding_status] || 'שלב לא הוגדר'
        lines.push(`• *${client.client_name}* — ${stage}`)
        if (!client.open_tasks.length) {
          lines.push('  אין משימות פתוחות')
          continue
        }
        for (const task of client.open_tasks) {
          const progress = task.status === 'in_progress' ? 'בתהליך' : 'פתוחה'
          lines.push(`  ↳ ${task.title} (${progress}${formatTaskDueDate(task.due_date)})`)
        }
      }
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
  const forceDelivery = body.force_delivery === true && body.source === 'approved_manual_trigger'
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
      .select('id, name, tenant_id, agency_id, is_ecommerce, services, agencies(name)')
      .in('agency_id', agencyIds.length ? agencyIds : ['00000000-0000-0000-0000-000000000000'])
      .eq('status', 'active').order('name')
    if (clientsError) { results.push({ tenant_id: tenantId, error: clientsError.message }); continue }
    const { data: onboardingClientsRaw, error: onboardingClientsError } = await supabase.from('clients')
      .select('id, name, agency_id, agencies(name)')
      .in('agency_id', agencyIds.length ? agencyIds : ['00000000-0000-0000-0000-000000000000'])
      .eq('status', 'onboarding').order('name')
    if (onboardingClientsError) {
      results.push({ tenant_id: tenantId, error: onboardingClientsError.message })
      continue
    }
    const onboardingClientIds = (onboardingClientsRaw || []).map((client: any) => client.id)
    const [onboardingResult, tasksResult] = onboardingClientIds.length
      ? await Promise.all([
          supabase.from('client_onboarding')
            .select('client_id, status, updated_at')
            .in('client_id', onboardingClientIds)
            .order('updated_at', { ascending: false }),
          supabase.from('tasks')
            .select('client_id, title, status, due_date, created_at')
            .in('client_id', onboardingClientIds)
            .in('status', ['open', 'in_progress'])
            .order('due_date', { ascending: true, nullsFirst: false })
            .order('created_at', { ascending: true }),
        ])
      : [{ data: [], error: null }, { data: [], error: null }]
    if (onboardingResult.error || tasksResult.error) {
      results.push({ tenant_id: tenantId, error: onboardingResult.error?.message || tasksResult.error?.message })
      continue
    }
    const latestOnboardingByClient = new Map<string, any>()
    for (const onboarding of onboardingResult.data || []) {
      if (!latestOnboardingByClient.has(onboarding.client_id)) {
        latestOnboardingByClient.set(onboarding.client_id, onboarding)
      }
    }
    const openTasksByClient = new Map<string, any[]>()
    for (const task of tasksResult.data || []) {
      openTasksByClient.set(task.client_id, [...(openTasksByClient.get(task.client_id) || []), task])
    }
    const onboardingClients = (onboardingClientsRaw || []).map((client: any) => ({
      client_name: client.name,
      agency_name: (client.agencies as any)?.name || null,
      onboarding_status: latestOnboardingByClient.get(client.id)?.status || null,
      open_tasks: openTasksByClient.get(client.id) || [],
    }))
    const campaignClients = (clients || []).filter((client: any) => clientCampaignServices(client).size > 0)
    const clientIds = campaignClients.map((client: any) => client.id)
    const tableResult = clientIds.length
      ? await supabase.from('crm_tables')
          .select('id, client_id, integration_type, integration_settings, campaign_active, last_sync_at')
          .in('client_id', clientIds)
          .in('integration_type', [...CAMPAIGN_TABLE_TYPES])
      : { data: [], error: null }
    if (tableResult.error) { results.push({ tenant_id: tenantId, error: tableResult.error.message }); continue }
    const activeTablesByClient = new Map<string, any[]>()
    for (const table of tableResult.data || []) {
      const client = campaignClients.find((item: any) => item.id === table.client_id)
      if (!client || !tableMatchesServices(table, clientCampaignServices(client))) continue
      if (table.campaign_active === false) continue
      const tables = activeTablesByClient.get(table.client_id) || []
      tables.push(table)
      activeTablesByClient.set(table.client_id, tables)
    }
    // A client with campaign services but no report table must be surfaced as a
    // missing connection. A client whose existing campaign tables are all
    // explicitly switched off is intentionally excluded from Carmen's report.
    const reportableClients = campaignClients.filter((client: any) => {
      const services = clientCampaignServices(client)
      const configured = (tableResult.data || []).filter((table: any) =>
        table.client_id === client.id && tableMatchesServices(table, services)
      )
      const expectedPlatforms = [
        ...(services.has('ppc_meta') ? ['meta'] : []),
        ...(services.has('ppc_google') ? ['google'] : []),
      ]
      return expectedPlatforms.some((platform) => {
        const platformConfigured = configured.filter((table: any) => platform === 'google'
          ? table.integration_type === 'google_ads'
          : table.integration_type === 'facebook_insights' || table.integration_type === 'facebook_ecommerce')
        return platformConfigured.length === 0 || platformConfigured.some((table: any) => table.campaign_active !== false)
      })
    })
    const metaToken = await getMetaToken(supabase, tenantId)
    let metaActivityCalls = 0

    const now = new Date()
    const d7 = new Date(now); d7.setDate(d7.getDate() - 7)
    const d14 = new Date(now); d14.setDate(d14.getDate() - 14)
    const d30 = new Date(now); d30.setDate(d30.getDate() - 30)
    const d7Str = d7.toISOString().slice(0, 10)
    const d14Str = d14.toISOString().slice(0, 10)
    const d30Str = d30.toISOString().slice(0, 10)
    const snapshots: any[] = []
    for (const client of reportableClients) {
      const activeTables = activeTablesByClient.get(client.id) || []
      const tableIds = activeTables.map((table: any) => table.id)
      const metaTable = activeTables.find((table: any) =>
        table.integration_type === 'facebook_insights' || table.integration_type === 'facebook_ecommerce'
      )
      const tableSettings = metaTable?.integration_settings || {}
      const adAccountId = tableSettings.ad_account_id || tableSettings.account_id || tableSettings.meta_account_id || null
      if (adAccountId && metaToken) metaActivityCalls += 1
      const lastMetaChange = metaTable
        ? await getLastMetaCampaignChange(metaToken, adAccountId)
        : { at: null, type: null, actor: null, object: null, availability: 'not_applicable' }
      let records: any[] = []
      if (tableIds.length) {
        // Prefer a server-side date filter so long histories cannot push the
        // recent window out of the default page. Fall back to an unfiltered
        // wider page + client filter if the JSON-path filter is empty/errors.
        const filtered = await supabase.from('crm_records').select('data')
          .in('table_id', tableIds)
          .filter('data->>date', 'gte', d30Str)
          .limit(5000)
        if (!filtered.error && (filtered.data?.length || 0) > 0) {
          records = filtered.data || []
        } else {
          if (filtered.error) {
            console.warn('[campaign-pulse] crm_records date filter failed', client.id, filtered.error.message)
          }
          const fallback = await supabase.from('crm_records').select('data')
            .in('table_id', tableIds)
            .limit(5000)
          records = fallback.data || []
          if (fallback.error) {
            console.warn('[campaign-pulse] crm_records fallback failed', client.id, fallback.error.message)
          }
        }
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
      const configuredForClient = (tableResult.data || []).filter((table: any) =>
        table.client_id === client.id && tableMatchesServices(table, clientCampaignServices(client))
      )
      const isEcommerce = effectiveIsEcommerce(client.is_ecommerce, activeTables)
      const { status, flags, stalePlatforms } = classifyCampaignPulseStatus({
        activeTables,
        hasConfiguredCampaignTable: configuredForClient.length > 0,
        recentRecordCount: recent.length,
        isEcommerce,
        spend7,
        leads7,
        purchases7: purchases,
        roas,
        cplChangePct: cplChange,
        nowMs: now.getTime(),
      })
      console.log('[campaign-pulse] client classified', {
        client_id: client.id,
        client_name: client.name,
        status,
        tables: activeTables.map((table: any) => ({
          id: table.id,
          type: table.integration_type,
          campaign_active: table.campaign_active,
        })),
        recent_records: recent.length,
        is_ecommerce: isEcommerce,
        stale_platforms: stalePlatforms,
        flags,
      })
      snapshots.push({
        tenant_id: tenantId, agency_id: client.agency_id, client_id: client.id,
        calculated_at: now.toISOString(), data_fresh_through: freshest, status,
        is_ecommerce: isEcommerce, spend_7d: round(spend7), leads_7d: round(leads7),
        cpl_7d: round(cpl7), cpl_change_pct: round(cplChange, 1), purchases_7d: round(purchases),
        revenue_7d: round(revenue), roas_7d: round(roas), flags, source: 'synced_crm',
        last_meta_change_at: lastMetaChange.at,
        last_meta_change_type: lastMetaChange.type,
        last_meta_change_actor: lastMetaChange.actor,
        last_meta_change_object: lastMetaChange.object,
        meta_change_availability: lastMetaChange.availability,
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
    const digest = buildDigest(snapshots, onboardingClients)
    let sent = false
    let deliveryClaimed = false
    if (deliveryRequested && setting.campaign_pulse_enabled && forceDelivery) {
      deliveryClaimed = true
    } else if (deliveryRequested && setting.campaign_pulse_enabled) {
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
      actions_taken: [{ type: 'deterministic_campaign_pulse', sent, ai_used: false, external_api_calls: metaActivityCalls }],
      summary: digest, duration_ms: Date.now() - started,
    })
    results.push({
      tenant_id: tenantId,
      clients: snapshots.length,
      onboarding_clients: onboardingClients.length,
      onboarding_open_tasks: onboardingClients.reduce((total: number, client: any) => total + client.open_tasks.length, 0),
      sent,
      delivery_channel: 'carmen_direct',
      delivery_requested: deliveryRequested,
      skipped_duplicate_delivery: deliveryRequested && setting.campaign_pulse_enabled && !forceDelivery && !deliveryClaimed,
      ai_used: false,
      external_api_calls: metaActivityCalls,
    })
  }
  return json({ success: true, results })
})
