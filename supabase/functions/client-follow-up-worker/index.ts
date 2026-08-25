import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'
import { isFollowUpDue } from './schedule.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

type NotificationType = 'client_follow_up_reminder' | 'client_follow_up_reminder_manager'

type ClientRow = {
  id: string
  tenant_id: string | null
  agency_id: string
  name: string
  status: string
  follow_up_date: string | null
  follow_up_campaigner_notified_at: string | null
  follow_up_manager_notified_at: string | null
}

type Recipient = {
  id: string | null
  full_name: string
  phone: string
}

async function invokeNotification(
  client: ClientRow,
  triggerType: NotificationType,
  recipient: Recipient,
  assigneeNames: string[],
) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/trigger-automation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({
      trigger_type: triggerType,
      data: {
        client_id: client.id,
        tenant_id: client.tenant_id,
        recipient_phone: recipient.phone,
        recipient_name: recipient.full_name,
        assignee_names: assigneeNames,
      },
    }),
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok && response.status !== 202) {
    throw new Error(body?.reason || body?.error || `trigger-automation returned ${response.status}`)
  }
  if (body?.sent === true) return { delivered: true, body }
  if (body?.handled === true && body?.sent === false) {
    return { delivered: false, body }
  }
  if (body?.success === true) {
    const delivered = Array.isArray(body.results)
      && body.results.some((result: any) => result?.success === true)
    return { delivered, body }
  }
  throw new Error(body?.reason || body?.error || 'client follow-up notification was not handled')
}

async function claimMarker(
  supabase: ReturnType<typeof createClient>,
  clientId: string,
  marker: 'follow_up_campaigner_notified_at' | 'follow_up_manager_notified_at',
) {
  const claimedAt = new Date().toISOString()
  const { data, error } = await supabase
    .from('clients')
    .update({ [marker]: claimedAt })
    .eq('id', clientId)
    .is(marker, null)
    .select('id')
    .maybeSingle()
  if (error) throw error
  return data ? claimedAt : null
}

async function releaseMarker(
  supabase: ReturnType<typeof createClient>,
  clientId: string,
  marker: 'follow_up_campaigner_notified_at' | 'follow_up_manager_notified_at',
  claimedAt: string,
) {
  await supabase
    .from('clients')
    .update({ [marker]: null })
    .eq('id', clientId)
    .eq(marker, claimedAt)
}

async function fetchClient(supabase: ReturnType<typeof createClient>, clientId: string) {
  const { data, error } = await supabase
    .from('clients')
    .select('id,tenant_id,agency_id,name,status,follow_up_date,follow_up_campaigner_notified_at,follow_up_manager_notified_at')
    .eq('id', clientId)
    .maybeSingle()
  if (error) throw error
  return data as ClientRow | null
}

async function getActiveCampaigners(
  supabase: ReturnType<typeof createClient>,
  clientId: string,
): Promise<Recipient[]> {
  const today = new Date().toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from('client_team')
    .select('campaigner_id, campaigners(id, full_name, phone, active)')
    .eq('client_id', clientId)
    .or(`start_date.is.null,start_date.lte.${today}`)
    .or(`end_date.is.null,end_date.gte.${today}`)
  if (error) throw error

  const recipients: Recipient[] = []
  const seenPhones = new Set<string>()
  for (const row of data || []) {
    const campaigner = (row as any).campaigners
    if (!campaigner?.active || !campaigner?.phone) continue
    const phone = String(campaigner.phone).trim()
    if (!phone || seenPhones.has(phone)) continue
    seenPhones.add(phone)
    recipients.push({
      id: campaigner.id,
      full_name: String(campaigner.full_name || ''),
      phone,
    })
  }
  return recipients
}

async function getManagers(
  supabase: ReturnType<typeof createClient>,
  client: ClientRow,
): Promise<Recipient[]> {
  if (!client.tenant_id) return []

  const [{ data: roleRows, error: rolesError }, { data: managedRows, error: managedError }] = await Promise.all([
    supabase
      .from('user_roles')
      .select('user_id, role')
      .eq('tenant_id', client.tenant_id)
      .in('role', ['owner', 'agency_owner', 'super_admin']),
    supabase
      .from('user_managed_agencies')
      .select('user_id')
      .eq('agency_id', client.agency_id),
  ])
  if (rolesError) throw rolesError
  if (managedError) throw managedError

  const managerUserIds = new Set<string>()
  for (const row of roleRows || []) managerUserIds.add(String((row as any).user_id))

  const { data: teamManagerRoles, error: teamManagerError } = await supabase
    .from('user_roles')
    .select('user_id')
    .eq('tenant_id', client.tenant_id)
    .eq('role', 'team_manager')
  if (teamManagerError) throw teamManagerError
  const managedUserIds = new Set((managedRows || []).map((row: any) => String(row.user_id)))
  for (const row of teamManagerRoles || []) {
    const userId = String((row as any).user_id)
    if (managedUserIds.has(userId)) managerUserIds.add(userId)
  }

  if (!managerUserIds.size) return []

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, full_name, phone')
    .in('id', [...managerUserIds])
  if (profilesError) throw profilesError

  const recipients: Recipient[] = []
  const seenPhones = new Set<string>()
  for (const profile of profiles || []) {
    const phone = String((profile as any).phone || '').trim()
    if (!phone || seenPhones.has(phone)) continue
    seenPhones.add(phone)
    recipients.push({
      id: (profile as any).id,
      full_name: String((profile as any).full_name || ''),
      phone,
    })
  }
  return recipients
}

async function notifyRecipients(
  supabase: ReturnType<typeof createClient>,
  client: ClientRow,
  triggerType: NotificationType,
  marker: 'follow_up_campaigner_notified_at' | 'follow_up_manager_notified_at',
  recipients: Recipient[],
  assigneeNames: string[],
) {
  if (!recipients.length) {
    const claimedAt = await claimMarker(supabase, client.id, marker)
    if (claimedAt) client[marker] = claimedAt
    return [{ client_id: client.id, trigger_type: triggerType, skipped: 'no recipients with phone' }]
  }

  const claimedAt = await claimMarker(supabase, client.id, marker)
  if (!claimedAt) {
    return [{ client_id: client.id, trigger_type: triggerType, skipped: 'already claimed' }]
  }

  const results: unknown[] = []
  let deliveredCount = 0
  try {
    for (const recipient of recipients) {
      const result = await invokeNotification(client, triggerType, recipient, assigneeNames)
      results.push({
        client_id: client.id,
        trigger_type: triggerType,
        recipient_id: recipient.id,
        sent: result.delivered,
        skipped: result.delivered ? undefined : result.body?.reason || 'no notification channel configured',
      })
      if (result.delivered) deliveredCount += 1
    }
    if (deliveredCount === 0) {
      await releaseMarker(supabase, client.id, marker, claimedAt)
      client[marker] = null
    } else {
      client[marker] = claimedAt
    }
  } catch (error) {
    await releaseMarker(supabase, client.id, marker, claimedAt)
    throw error
  }
  return results
}

async function processClient(supabase: ReturnType<typeof createClient>, client: ClientRow) {
  if (!client.follow_up_date) return []
  if (!['active', 'onboarding'].includes(client.status)) return []
  if (!isFollowUpDue(client.follow_up_date)) return []

  const campaigners = await getActiveCampaigners(supabase, client.id)
  const assigneeNames = campaigners.map((c) => c.full_name).filter(Boolean)
  const results: unknown[] = []

  if (!client.follow_up_campaigner_notified_at) {
    results.push(...await notifyRecipients(
      supabase,
      client,
      'client_follow_up_reminder',
      'follow_up_campaigner_notified_at',
      campaigners,
      assigneeNames,
    ))
  }

  if (!client.follow_up_manager_notified_at) {
    const managers = await getManagers(supabase, client)
    results.push(...await notifyRecipients(
      supabase,
      client,
      'client_follow_up_reminder_manager',
      'follow_up_manager_notified_at',
      managers,
      assigneeNames,
    ))
  }

  return results
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const results: unknown[] = []
  const errors: Array<{ client_id: string; error: string }> = []

  try {
    const body = await req.json().catch(() => ({}))
    let clients: ClientRow[] = []
    const clientColumns = 'id,tenant_id,agency_id,name,status,follow_up_date,follow_up_campaigner_notified_at,follow_up_manager_notified_at'

    if (body?.client_id) {
      const client = await fetchClient(supabase, String(body.client_id))
      if (client) clients = [client]
    } else {
      const today = new Date().toISOString().slice(0, 10)
      const [campaignerPending, managerPending] = await Promise.all([
        supabase
          .from('clients')
          .select(clientColumns)
          .not('follow_up_date', 'is', null)
          .lte('follow_up_date', today)
          .in('status', ['active', 'onboarding'])
          .is('follow_up_campaigner_notified_at', null)
          .limit(25),
        supabase
          .from('clients')
          .select(clientColumns)
          .not('follow_up_date', 'is', null)
          .lte('follow_up_date', today)
          .in('status', ['active', 'onboarding'])
          .is('follow_up_manager_notified_at', null)
          .limit(25),
      ])
      const queryErrors = [campaignerPending.error, managerPending.error].filter(Boolean)
      if (queryErrors.length) throw queryErrors[0]

      const unique = new Map<string, ClientRow>()
      for (const client of [
        ...(campaignerPending.data || []),
        ...(managerPending.data || []),
      ] as ClientRow[]) unique.set(client.id, client)
      clients = [...unique.values()]
    }

    for (const client of clients) {
      try {
        results.push(...await processClient(supabase, client))
      } catch (error) {
        errors.push({
          client_id: client.id,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    console.log('[client-follow-up-worker]', { clients: clients.length, results: results.length, errors })
    return new Response(JSON.stringify({ ok: errors.length === 0, processed: clients.length, results, errors }), {
      status: errors.length ? 207 : 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[client-follow-up-worker] fatal error', error)
    return new Response(JSON.stringify({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
