import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const MANUAL_TRIGGER_TOKEN_SHA256 =
  'd64e13eff69a0ed5dc419c8cf0c2d13cf81c75fd4b62848b16bdc293d388bc2a'
const TENANT_IDS = [
  '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019', // MarketingCaptain
  '6ad8f321-25db-4a04-8e44-e57a7c8961b2', // DMM
] as const

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || ''
  if (!bearer || await sha256(bearer) !== MANUAL_TRIGGER_TOKEN_SHA256) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
  const { data: settings, error: settingsError } = await supabase
    .from('tenant_heartbeat_settings')
    .select('tenant_id, campaign_pulse_enabled')
    .in('tenant_id', [...TENANT_IDS])

  if (settingsError) return json({ error: settingsError.message }, 500)
  const enabled = new Set(
    (settings || [])
      .filter((setting) => setting.campaign_pulse_enabled)
      .map((setting) => setting.tenant_id),
  )
  const missingOrDisabled = TENANT_IDS.filter((tenantId) => !enabled.has(tenantId))
  if (missingOrDisabled.length) {
    return json({ error: 'Campaign pulse is not enabled for every approved tenant', tenant_ids: missingOrDisabled }, 409)
  }

  const results = []
  for (const tenantId of TENANT_IDS) {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/campaign-pulse-snapshot`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({ tenant_id: tenantId, deliver: true, source: 'approved_manual_trigger' }),
    })
    const payload = await response.json().catch(() => ({ error: 'Invalid response' }))
    results.push({ tenant_id: tenantId, ok: response.ok, payload })
  }

  return json({ success: results.every((result) => result.ok), results })
})
