/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'
import {
  CAMPAIGN_TABLE_TYPES,
  buildPulseDashboardAbsoluteUrl,
  buildPulseWhatsAppDigest,
  classifyCampaignPulseStatus,
  clientAdAccountIds,
  clientCampaignServices as servicesFromClient,
  countStoppedCampaignsByClient,
  computeGoalMetricsFromRecords,
  detectCampaignGoalMode,
  integrationTypeToGoal,
  isPulseDeliveryExcludedPhone,
  selectPulseCriticalAlerts,
  tableMatchesServices,
  worstPulseStatus,
} from '../_shared/campaign-pulse.ts'
import { normalizeNotifyPhone } from '../_shared/carmen-notify-target.ts'
import {
  buildPulsePreviewMessage,
  mergePulseDeliveryPlans,
  planCampaignerPulseDeliveries,
  planTeamManagerPulseDeliveries,
  scopeSnapshotsForPlan,
  type PulseDeliveryPlan,
} from '../_shared/pulse-delivery.ts'

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
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 2500)
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
    const response = await fetch(
      `https://graph.facebook.com/${META_GRAPH_VERSION}/act_${account}/activities?${params}`,
      { signal: controller.signal },
    )
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
  } finally {
    clearTimeout(timer)
  }
}

function bearerAuthorized(authHeader: string | null): boolean {
  if (!authHeader) return false
  const cronSecret = Deno.env.get('CAMPAIGN_PULSE_CRON_SECRET')
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true
  if (SERVICE_KEY && authHeader === `Bearer ${SERVICE_KEY}`) return true
  // Accept any service_role JWT for this project (keys can differ between
  // callers / rotated secrets while still being valid for the same ref).
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  try {
    const payloadPart = token.split('.')[1]
    if (!payloadPart) return false
    const normalized = payloadPart.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
    const payload = JSON.parse(atob(padded))
    const projectRef = Deno.env.get('SUPABASE_PROJECT_ID') || 'zvoijyneresvkadpprel'
    return payload?.role === 'service_role' && (!payload?.ref || payload.ref === projectRef)
  } catch {
    return false
  }
}

async function queuePulseWhatsApp(
  supabase: any,
  tenantId: string,
  message: string,
  chatId: string | null,
): Promise<boolean> {
  if (isPulseDeliveryExcludedPhone(chatId)) return false
  const delivery = await supabase.rpc('claude_notify_david', {
    p_message: message,
    p_tenant: tenantId,
    p_chat_id: chatId,
  })
  return !delivery.error && delivery.data?.queued === true
}

async function loadTeamManagerDeliveryPlans(
  supabase: any,
  tenantId: string,
  snapshots: Array<{ client_id: string; agency_id?: string | null }>,
): Promise<PulseDeliveryPlan[]> {
  const { data: roles } = await supabase
    .from('user_roles')
    .select('user_id')
    .eq('tenant_id', tenantId)
    .eq('role', 'team_manager')
  const userIds = Array.from(new Set((roles || []).map((row: any) => row.user_id).filter(Boolean)))
  if (!userIds.length) return []

  const [{ data: profiles }, { data: managed }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, campaigner_id, campaigners ( phone )')
      .in('id', userIds),
    supabase
      .from('user_managed_agencies')
      .select('user_id, agency_id')
      .in('user_id', userIds),
  ])

  const agenciesByUser = new Map<string, string[]>()
  for (const row of managed || []) {
    if (!row.user_id || !row.agency_id) continue
    agenciesByUser.set(row.user_id, [...(agenciesByUser.get(row.user_id) || []), row.agency_id])
  }

  return planTeamManagerPulseDeliveries(
    snapshots,
    (profiles || []).map((profile: any) => ({
      user_id: profile.id,
      full_name: profile.full_name,
      phone: profile.campaigners?.phone || null,
      agency_ids: agenciesByUser.get(profile.id) || [],
    })),
  )
}

async function deliverScopedPulseRecipients(
  supabase: any,
  tenantId: string,
  snapshots: any[],
  dashboardUrl: string,
  plans: PulseDeliveryPlan[],
  previewPhone: string | null,
  skipPhones: Set<string>,
  previewOnly = false,
): Promise<any[]> {
  const deliveries: any[] = []
  for (const plan of plans) {
    const recipientPhone = normalizeNotifyPhone(plan.phone)
    if (!recipientPhone || skipPhones.has(recipientPhone)) continue

    const scoped = scopeSnapshotsForPlan(snapshots, plan)
    if (!scoped.length) continue

    const scopedDigest = buildPulseWhatsAppDigest(scoped, dashboardUrl)
    const previewTarget = isPulseDeliveryExcludedPhone(previewPhone) ? null : previewPhone
    if (previewTarget) {
      const previewQueued = await queuePulseWhatsApp(
        supabase,
        tenantId,
        buildPulsePreviewMessage(plan.name, scopedDigest),
        previewTarget,
      )
      deliveries.push({
        type: 'preview',
        recipient: plan.name,
        role: plan.role,
        preview_phone: previewTarget,
        clients: scoped.length,
        queued: previewQueued,
      })
    }

    if (previewOnly) continue

    const queued = await queuePulseWhatsApp(supabase, tenantId, scopedDigest, recipientPhone)
    deliveries.push({
      type: plan.role,
      recipient: plan.name,
      phone: recipientPhone,
      clients: scoped.length,
      queued,
    })
  }
  return deliveries
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok')
  if (!bearerAuthorized(req.headers.get('authorization'))) {
    return json({ error: 'Unauthorized' }, 401)
  }
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
  let body: any = {}
  try { body = await req.json() } catch { /* empty cron body */ }
  // Only explicit deliver:true may send WhatsApp — sync crons refresh snapshots only.
  const deliveryRequested = body.deliver === true
  const manualDeliveryBypass =
    body.force_delivery === true && body.source === 'approved_manual_trigger'
  const previewOnlyDelivery =
    body.preview_only === true && body.source === 'approved_manual_trigger'
  let settingsQuery = supabase.from('tenant_heartbeat_settings')
    .select('tenant_id, campaign_pulse_enabled, campaign_pulse_last_sent_at, campaign_pulse_phone, campaign_pulse_deliver_to_campaigners, campaign_pulse_deliver_to_team_managers, campaign_pulse_preview_phone')
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
        supabase.from('agency_tenant_access').select('agency_id, source_tenant_id').eq('accessing_tenant_id', tenantId),
      ])
    if (ownedAgenciesError || sharedAgenciesError) {
      results.push({ tenant_id: tenantId, error: ownedAgenciesError?.message || sharedAgenciesError?.message })
      continue
    }
    const agencyIds = Array.from(new Set([
      ...(ownedAgencies || []).map((agency: any) => agency.id),
      ...(sharedAgencies || []).map((agency: any) => agency.agency_id),
    ]))
    // Alerts for a shared agency are recorded under the agency's source tenant.
    const alertTenantIds = Array.from(new Set([
      tenantId,
      ...(sharedAgencies || []).map((agency: any) => agency.source_tenant_id).filter(Boolean),
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
    // Client-call freshness and alerts are additive signals: when their schema is
    // not deployed yet the pulse must still be computed and delivered.
    const callUpdateResult = clientIds.length
      ? await supabase.rpc('get_latest_client_call_updates', { p_client_ids: clientIds })
      : { data: [], error: null }
    if (callUpdateResult.error) {
      console.warn('[campaign-pulse] client call lookup unavailable', callUpdateResult.error.message)
    }
    const clientCallDataAvailable = !callUpdateResult.error
    const latestCallByClient = new Map<string, any>()
    for (const update of callUpdateResult.data || []) {
      latestCallByClient.set(update.client_id, update)
    }
    const activeTablesByClient = new Map<string, any[]>()
    for (const table of tableResult.data || []) {
      const client = campaignClients.find((item: any) => item.id === table.client_id)
      if (!client || !tableMatchesServices(table, clientCampaignServices(client))) continue
      if (table.campaign_active === false) continue
      const tables = activeTablesByClient.get(table.client_id) || []
      tables.push(table)
      activeTablesByClient.set(table.client_id, tables)
    }
    // Critical alerts (stopped campaigns, disapproved ads) are only reported for
    // clients that still have an active campaign table.
    const alertResult = await supabase.from('campaign_alerts')
      .select('client_id, ad_account_id, campaign_id, campaign_name, alert_type, severity')
      .in('tenant_id', alertTenantIds)
      .is('resolved_at', null)
      .order('created_at', { ascending: false })
      .limit(500)
    if (alertResult.error) {
      console.warn('[campaign-pulse] campaign alerts unavailable', alertResult.error.message)
    }
    const criticalIssues = selectPulseCriticalAlerts(alertResult.data || [], campaignClients.map((client: any) => {
      const activeTables = activeTablesByClient.get(client.id) || []
      return {
        clientId: client.id,
        clientName: client.name,
        adAccountIds: clientAdAccountIds(activeTables),
        hasActiveCampaignTable: activeTables.length > 0,
      }
    }))
    const stoppedByClient = countStoppedCampaignsByClient(criticalIssues)

    // Include EVERY active client with ppc_meta/ppc_google — never drop clients
    // because Meta activity timed out or all tables were paused.
    const reportableClients = campaignClients
    const metaToken = await getMetaToken(supabase, tenantId)
    let metaActivityCalls = 0
    const MAX_META_ACTIVITY_CALLS = 25

    const now = new Date()
    const d7 = new Date(now); d7.setDate(d7.getDate() - 7)
    const d14 = new Date(now); d14.setDate(d14.getDate() - 14)
    const d30 = new Date(now); d30.setDate(d30.getDate() - 30)
    const d7Str = d7.toISOString().slice(0, 10)
    const d14Str = d14.toISOString().slice(0, 10)
    const d30Str = d30.toISOString().slice(0, 10)
    const snapshots: any[] = []
    for (const client of reportableClients) {
      try {
        const activeTables = activeTablesByClient.get(client.id) || []
        const tableIds = activeTables.map((table: any) => table.id)
        const metaTable = activeTables.find((table: any) =>
          table.integration_type === 'facebook_insights' || table.integration_type === 'facebook_ecommerce'
        )
        const tableSettings = metaTable?.integration_settings || {}
        const adAccountId = tableSettings.ad_account_id || tableSettings.account_id || tableSettings.meta_account_id || null
        let lastMetaChange = { at: null as string | null, type: null as string | null, actor: null as string | null, object: null as string | null, availability: 'not_applicable' }
        if (metaTable) {
          if (adAccountId && metaToken && metaActivityCalls < MAX_META_ACTIVITY_CALLS) {
            metaActivityCalls += 1
            lastMetaChange = await getLastMetaCampaignChange(metaToken, adAccountId)
          } else if (adAccountId && metaToken) {
            lastMetaChange = { at: null, type: null, actor: null, object: null, availability: 'meta_api_skipped_budget' }
          } else {
            lastMetaChange = await getLastMetaCampaignChange(metaToken, adAccountId)
          }
        }
        let records: any[] = []
        if (tableIds.length) {
          const filtered = await supabase.from('crm_records').select('table_id, data')
            .in('table_id', tableIds)
            .filter('data->>date', 'gte', d30Str)
            .limit(5000)
          if (!filtered.error && (filtered.data?.length || 0) > 0) {
            records = filtered.data || []
          } else {
            if (filtered.error) {
              console.warn('[campaign-pulse] crm_records date filter failed', client.id, filtered.error.message)
            }
            const fallback = await supabase.from('crm_records').select('table_id, data')
              .in('table_id', tableIds)
              .limit(5000)
            records = fallback.data || []
            if (fallback.error) {
              console.warn('[campaign-pulse] crm_records fallback failed', client.id, fallback.error.message)
            }
          }
        }
        const tableTypeById = new Map(activeTables.map((table: any) => [table.id, table.integration_type]))
        const recordsForGoal = (goal: 'leads' | 'ecommerce') =>
          records.filter((row: any) => integrationTypeToGoal(tableTypeById.get(row.table_id)) === goal)
        const leadRecords = recordsForGoal('leads')
        const ecommerceRecords = recordsForGoal('ecommerce')
        const recent = records.filter((row: any) => row.data?.date && row.data.date >= d30Str)
        const goalMode = detectCampaignGoalMode(activeTables)
        const leadMetrics = computeGoalMetricsFromRecords(leadRecords, 'leads', d7Str, d14Str)
        const ecommerceMetrics = computeGoalMetricsFromRecords(ecommerceRecords, 'ecommerce', d7Str, d14Str)
        const spend7 = leadMetrics.spend + ecommerceMetrics.spend
        const leads7 = leadMetrics.outcomes
        const purchases = ecommerceMetrics.outcomes
        const revenue = ecommerceMetrics.revenue
        const cpl7 = leadMetrics.efficiency
        const cplChange = leadMetrics.changePct
        const roas = ecommerceMetrics.efficiency
        const roasChange = ecommerceMetrics.changePct
        const freshest = recent.map((row: any) => row.data?.date).filter(Boolean).sort().reverse()[0] || null
        const configuredForClient = (tableResult.data || []).filter((table: any) =>
          table.client_id === client.id && tableMatchesServices(table, clientCampaignServices(client))
        )
        const latestCall = latestCallByClient.get(client.id) || null
        const lastClientCallAt = clientCallDataAvailable ? (latestCall?.last_client_call_at || null) : undefined
        const stoppedCount = stoppedByClient.get(client.id) || 0
        const leadTables = activeTables.filter((table: any) => integrationTypeToGoal(table.integration_type) === 'leads')
        const ecommerceTables = activeTables.filter((table: any) => integrationTypeToGoal(table.integration_type) === 'ecommerce')
        const leadClassification = classifyCampaignPulseStatus({
          activeTables: leadTables,
          hasConfiguredCampaignTable: configuredForClient.some((table: any) => integrationTypeToGoal(table.integration_type) === 'leads'),
          recentRecordCount: leadRecords.filter((row: any) => row.data?.date && row.data.date >= d30Str).length,
          isEcommerce: false,
          spend7: leadMetrics.spend,
          leads7: leadMetrics.outcomes,
          purchases7: 0,
          roas: null,
          cplChangePct: leadMetrics.changePct,
          lastClientCallAt: goalMode !== 'ecommerce' ? lastClientCallAt : undefined,
          stoppedCampaignCount: goalMode !== 'ecommerce' ? stoppedCount : 0,
          nowMs: now.getTime(),
        })
        const ecommerceClassification = classifyCampaignPulseStatus({
          activeTables: ecommerceTables,
          hasConfiguredCampaignTable: configuredForClient.some((table: any) => integrationTypeToGoal(table.integration_type) === 'ecommerce'),
          recentRecordCount: ecommerceRecords.filter((row: any) => row.data?.date && row.data.date >= d30Str).length,
          isEcommerce: true,
          spend7: ecommerceMetrics.spend,
          leads7: 0,
          purchases7: ecommerceMetrics.outcomes,
          roas: ecommerceMetrics.efficiency,
          cplChangePct: null,
          lastClientCallAt: goalMode === 'ecommerce' ? lastClientCallAt : undefined,
          stoppedCampaignCount: goalMode === 'ecommerce' ? stoppedCount : 0,
          nowMs: now.getTime(),
        })
        const leadStatus = goalMode === 'ecommerce' ? null : leadClassification.status
        const ecommerceStatus = goalMode === 'leads' ? null : ecommerceClassification.status
        const status = goalMode === 'hybrid'
          ? worstPulseStatus(leadClassification.status, ecommerceClassification.status)
          : goalMode === 'ecommerce'
            ? ecommerceClassification.status
            : leadClassification.status
        const flags = Array.from(new Set([
          ...(goalMode !== 'ecommerce' ? leadClassification.flags : []),
          ...(goalMode !== 'leads' ? ecommerceClassification.flags : []),
        ]))
        const stalePlatforms = Array.from(new Set([
          ...leadClassification.stalePlatforms,
          ...ecommerceClassification.stalePlatforms,
        ]))
        const isEcommerce = goalMode === 'ecommerce' || goalMode === 'hybrid'
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
          campaign_goal_mode: goalMode,
          is_ecommerce: isEcommerce,
          lead_spend_7d: round(leadMetrics.spend),
          ecommerce_spend_7d: round(ecommerceMetrics.spend),
          spend_7d: round(spend7),
          leads_7d: round(leads7),
          cpl_7d: round(cpl7),
          cpl_change_pct: round(cplChange, 1),
          purchases_7d: round(purchases),
          revenue_7d: round(revenue),
          roas_7d: round(roas),
          roas_change_pct: round(roasChange, 1),
          lead_goal_status: leadStatus,
          ecommerce_goal_status: ecommerceStatus,
          flags, source: 'synced_crm',
          last_meta_change_at: lastMetaChange.at,
          last_meta_change_type: lastMetaChange.type,
          last_meta_change_actor: lastMetaChange.actor,
          last_meta_change_object: lastMetaChange.object,
          meta_change_availability: lastMetaChange.availability,
          last_client_call_at: latestCall?.last_client_call_at || null,
          last_client_call_by: latestCall?.last_client_call_by || null,
          client_name: client.name, agency_name: (client.agencies as any)?.name || null,
        })
      } catch (clientError) {
        console.error('[campaign-pulse] client failed — writing no_data row', client.id, clientError)
        snapshots.push({
          tenant_id: tenantId, agency_id: client.agency_id, client_id: client.id,
          calculated_at: now.toISOString(), data_fresh_through: null, status: 'no_data',
          campaign_goal_mode: detectCampaignGoalMode(activeTablesByClient.get(client.id) || []),
          is_ecommerce: !!client.is_ecommerce, spend_7d: 0, leads_7d: 0,
          lead_spend_7d: 0, ecommerce_spend_7d: 0,
          cpl_7d: null, cpl_change_pct: null, purchases_7d: 0,
          revenue_7d: 0, roas_7d: null, roas_change_pct: null,
          lead_goal_status: 'no_data', ecommerce_goal_status: null,
          flags: ['שגיאה בחישוב דופק — נסה שוב'],
          source: 'synced_crm',
          last_meta_change_at: null, last_meta_change_type: null,
          last_meta_change_actor: null, last_meta_change_object: null,
          meta_change_availability: 'meta_api_unavailable',
          last_client_call_at: null, last_client_call_by: null,
          client_name: client.name, agency_name: (client.agencies as any)?.name || null,
        })
      }
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
      let { error } = await supabase.from('campaign_pulse_snapshots')
        .upsert(rows, { onConflict: 'tenant_id,client_id' })
      if (error && /last_client_call/.test(error.message)) {
        // Columns not deployed yet — persist the pulse without the call fields.
        console.warn('[campaign-pulse] client call columns missing, writing without them')
        const legacyRows = rows.map(({ last_client_call_at: _at, last_client_call_by: _by, ...row }) => row)
        const retry = await supabase.from('campaign_pulse_snapshots')
          .upsert(legacyRows, { onConflict: 'tenant_id,client_id' })
        error = retry.error
      }
      if (error) { results.push({ tenant_id: tenantId, error: error.message }); continue }
    }
    const { data: tenantRow } = await supabase.from('tenants').select('slug').eq('id', tenantId).maybeSingle()
    const tenantSlug = tenantRow?.slug || tenantId
    const dashboardUrl = buildPulseDashboardAbsoluteUrl(tenantSlug)
    const digest = buildPulseWhatsAppDigest(snapshots, dashboardUrl, criticalIssues)
    let sent = false
    let deliveryClaimed = false
    const scopedDeliveries: any[] = []
    if (deliveryRequested && setting.campaign_pulse_enabled) {
      if (manualDeliveryBypass) {
        deliveryClaimed = true
      } else {
        const claim = await supabase.rpc('claim_campaign_pulse_delivery', { p_tenant_id: tenantId })
        deliveryClaimed = claim.data === true && !claim.error
        if (claim.error) console.error('Failed to claim campaign pulse delivery:', claim.error.message)
      }
    }
    if (deliveryClaimed) {
      const skipPhones = new Set(
        [normalizeNotifyPhone(setting.campaign_pulse_phone)].filter((phone): phone is string => !!phone),
      )

      // Full-tenant digest to the configured management phone (e.g. Felix on DMM).
      if (!previewOnlyDelivery && setting.campaign_pulse_phone) {
        sent = await queuePulseWhatsApp(supabase, tenantId, digest, setting.campaign_pulse_phone)
        if (!sent) {
          console.error('Failed to queue full campaign pulse via Carmen Direct')
        }
      }

      const deliverToCampaigners = setting.campaign_pulse_deliver_to_campaigners === true
      const deliverToManagers = setting.campaign_pulse_deliver_to_team_managers === true
      if (deliverToCampaigners || deliverToManagers) {
        const snapshotClientIds = snapshots.map((snapshot) => snapshot.client_id)
        const plans: PulseDeliveryPlan[] = []

        if (deliverToCampaigners && snapshotClientIds.length) {
          const [{ data: links }, { data: campaigners }] = await Promise.all([
            supabase.from('client_team').select('campaigner_id, client_id').in('client_id', snapshotClientIds),
            supabase.from('campaigners').select('id, full_name, phone').eq('tenant_id', tenantId).eq('active', true),
          ])
          plans.push(...planCampaignerPulseDeliveries(snapshots, links || [], campaigners || []))
        }

        if (deliverToManagers) {
          plans.push(...await loadTeamManagerDeliveryPlans(supabase, tenantId, snapshots))
        }

        const mergedPlans = mergePulseDeliveryPlans(plans)
        const recipientDeliveries = await deliverScopedPulseRecipients(
          supabase,
          tenantId,
          snapshots,
          dashboardUrl,
          mergedPlans,
          setting.campaign_pulse_preview_phone || null,
          skipPhones,
          previewOnlyDelivery,
        )
        scopedDeliveries.push(...recipientDeliveries)
        if (!sent) {
          sent = previewOnlyDelivery
            ? recipientDeliveries.some((row) => row.type === 'preview' && row.queued === true)
            : recipientDeliveries.some((row) => row.type !== 'preview' && row.queued === true)
        }
      }

      if (!sent) {
        await supabase.from('tenant_heartbeat_settings')
          .update({ campaign_pulse_last_sent_at: null }).eq('tenant_id', tenantId)
      }
    }
    await supabase.from('heartbeat_logs').insert({
      tenant_id: tenantId, tasks_reviewed: snapshots.length,
      actions_taken: [{
        type: 'deterministic_campaign_pulse',
        sent,
        ai_used: false,
        external_api_calls: metaActivityCalls,
        dashboard_url: dashboardUrl,
        clients_checked: snapshots.length,
        scoped_deliveries: scopedDeliveries,
      }],
      summary: digest, duration_ms: Date.now() - started,
    })
    results.push({
      tenant_id: tenantId,
      clients: snapshots.length,
      onboarding_clients: onboardingClients.length,
      onboarding_open_tasks: onboardingClients.reduce((total: number, client: any) => total + client.open_tasks.length, 0),
      sent,
      scoped_deliveries: scopedDeliveries,
      delivery_channel: 'carmen_direct',
      delivery_requested: deliveryRequested,
      skipped_duplicate_delivery: deliveryRequested && setting.campaign_pulse_enabled && !manualDeliveryBypass && !deliveryClaimed,
      ai_used: false,
      external_api_calls: metaActivityCalls,
    })
  }
  return json({ success: true, results })
})
