import {
  buildCampaignShutdownReport,
  CampaignShutdownJob,
  CampaignShutdownRunResult,
  isActiveCampaignStatus,
  isPausedCampaignStatus,
  selectCampaignsForShutdown,
  ShutdownCampaignRow,
} from './client-campaign-shutdown.ts'

const FB_GRAPH_VERSION = 'v21.0'

async function fbGetToken(supabase: any, tenantId: string): Promise<string | null> {
  let { data: integ } = await supabase
    .from('tenant_integrations')
    .select('api_key, shared_from_integration_id')
    .eq('tenant_id', tenantId)
    .in('integration_type', ['facebook', 'facebook_lead_ads'])
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()
  if (integ?.shared_from_integration_id && !integ?.api_key) {
    const { data: src } = await supabase
      .from('tenant_integrations')
      .select('api_key')
      .eq('id', integ.shared_from_integration_id)
      .eq('is_active', true)
      .maybeSingle()
    if (src?.api_key) integ = { ...integ, api_key: src.api_key }
  }
  return integ?.api_key || null
}

async function fbResolveClientAdAccount(supabase: any, tenantId: string, clientId: string): Promise<string | null> {
  const { data: cl } = await supabase.from('clients').select('meta_ads_account_id, tenant_id').eq('id', clientId).maybeSingle()
  if (cl?.meta_ads_account_id) return String(cl.meta_ads_account_id).replace(/^act_/, '')
  const tokenTenant = cl?.tenant_id || tenantId
  const { data: tables } = await supabase
    .from('crm_tables')
    .select('integration_settings')
    .eq('client_id', clientId)
    .in('integration_type', ['facebook_insights', 'facebook_ecommerce'])
    .limit(5)
  for (const t of tables || []) {
    const s = t?.integration_settings || {}
    const acc = s.ad_account_id || s.account_id || s.meta_account_id
    if (acc) return String(acc).replace(/^act_/, '')
  }
  return null
}

async function fbLiveCampaignList(
  supabase: any,
  tenantId: string,
  clientId: string,
): Promise<ShutdownCampaignRow[] | null> {
  try {
    const acct = await fbResolveClientAdAccount(supabase, tenantId, clientId)
    const { data: cl } = await supabase.from('clients').select('tenant_id').eq('id', clientId).maybeSingle()
    const tokenTenant = cl?.tenant_id || tenantId
    let token = await fbGetToken(supabase, tokenTenant)
    if (!token && tokenTenant !== tenantId) token = await fbGetToken(supabase, tenantId)
    if (!acct || !token) return null
    const url = `https://graph.facebook.com/${FB_GRAPH_VERSION}/act_${acct}/campaigns?fields=id,name,effective_status&limit=300&access_token=${token}`
    const r = await fetch(url)
    const j = await r.json()
    if (!r.ok || j?.error || !Array.isArray(j?.data)) return null
    return j.data.map((c: any) => ({
      campaign_id: String(c.id),
      campaign_name: String(c.name || ''),
      effective_status: String(c.effective_status || ''),
    }))
  } catch {
    return null
  }
}

export async function resolveClientForShutdownJob(
  supabase: any,
  tenantId: string,
  job: CampaignShutdownJob,
): Promise<{ id: string; name: string } | null> {
  if (job.client_id) {
    const { data } = await supabase.from('clients').select('id, name').eq('id', job.client_id).maybeSingle()
    return data ? { id: data.id, name: data.name } : null
  }
  const search = (job.client_name_search || '').trim()
  if (!search) return null
  const { data: rows } = await supabase
    .from('clients')
    .select('id, name')
    .eq('tenant_id', tenantId)
    .ilike('name', `%${search.replace(/[%_]/g, '')}%`)
    .limit(5)
  if (!rows?.length) return null
  const exact = rows.find((r: any) => String(r.name).toLowerCase() === search.toLowerCase())
  return { id: (exact || rows[0]).id, name: (exact || rows[0]).name }
}

async function pauseCampaign(
  supabaseUrl: string,
  serviceKey: string,
  tenantId: string,
  clientId: string,
  campaignId: string,
): Promise<{ ok: boolean; error?: string }> {
  const r = await fetch(`${supabaseUrl}/functions/v1/carmen-fb-tools`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({
      tenant_id: tenantId,
      client_id: clientId,
      action: 'pause',
      entity_id: campaignId,
      confirmed: true,
    }),
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok || j?.error) {
    return { ok: false, error: String(j?.error || j?.message || r.status) }
  }
  return { ok: true }
}

export async function runClientCampaignShutdownJob(
  supabase: any,
  opts: {
    tenantId: string
    job: CampaignShutdownJob
    supabaseUrl: string
    serviceRoleKey: string
  },
): Promise<CampaignShutdownRunResult> {
  const client = await resolveClientForShutdownJob(supabase, opts.tenantId, opts.job)
  if (!client) {
    throw new Error('client_not_found_for_shutdown_job')
  }
  const scope = opts.job.scope ?? { mode: 'all_client_campaigns' as const }
  const live = await fbLiveCampaignList(supabase, opts.tenantId, client.id)
  if (!live) throw new Error('fb_live_campaign_list_failed')

  const { checked, skipped_out_of_scope } = selectCampaignsForShutdown(live, scope)
  const already_paused: ShutdownCampaignRow[] = []
  const newly_paused: ShutdownCampaignRow[] = []
  const still_active: ShutdownCampaignRow[] = []
  const pause_errors: CampaignShutdownRunResult['pause_errors'] = []

  for (const row of checked) {
    if (isPausedCampaignStatus(row.effective_status)) {
      already_paused.push(row)
      continue
    }
    if (!isActiveCampaignStatus(row.effective_status)) {
      skipped_out_of_scope.push(row)
      continue
    }
    if (opts.job.auto_pause !== false) {
      const pr = await pauseCampaign(opts.supabaseUrl, opts.serviceRoleKey, opts.tenantId, client.id, row.campaign_id)
      if (pr.ok) newly_paused.push(row)
      else {
        pause_errors.push({ campaign_id: row.campaign_id, campaign_name: row.campaign_name, error: pr.error || 'pause_failed' })
        still_active.push(row)
      }
    } else {
      still_active.push(row)
    }
  }

  const base = {
    client_id: client.id,
    client_name: client.name,
    scope,
    checked,
    skipped_out_of_scope,
    already_paused,
    newly_paused,
    still_active,
    pause_errors,
  }
  return { ...base, report: buildCampaignShutdownReport(base) }
}
