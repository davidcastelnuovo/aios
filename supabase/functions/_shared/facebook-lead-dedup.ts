/** Idempotency for Facebook Instant Form → automation WhatsApp sends. */

export const facebookFlowEventSource = (automationId: string) => `fb-flow:${automationId}`

const asId = (value: unknown): string => String(value ?? "").trim()
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const asUuid = (value: unknown): string | null => {
  const id = asId(value)
  return UUID_RE.test(id) ? id : null
}

export async function claimFacebookLeadAutomationRun(
  supabase: { from: (table: string) => any },
  params: {
    tenantId: string
    automationId: string
    leadgenId: unknown
    formId?: unknown
    clientId?: unknown
  },
): Promise<{ duplicate: boolean }> {
  const leadgenId = asId(params.leadgenId)
  if (!leadgenId || !params.tenantId || !params.automationId) {
    return { duplicate: false }
  }

  const { error } = await supabase.from("lead_notification_events").insert({
    tenant_id: params.tenantId,
    source: facebookFlowEventSource(params.automationId),
    external_id: leadgenId,
    form_id: asId(params.formId) || null,
    client_id: asUuid(params.clientId),
  })

  if (error?.code === "23505") return { duplicate: true }
  if (error) {
    console.error("[facebook-lead-dedup] claim insert failed (continuing):", error.message)
  }
  return { duplicate: false }
}

export async function wasFacebookLeadAutomationClaimed(
  supabase: { from: (table: string) => any },
  params: { tenantId: string; automationId: string; leadgenId: unknown },
): Promise<boolean> {
  const leadgenId = asId(params.leadgenId)
  if (!leadgenId || !params.tenantId || !params.automationId) return false

  const { data } = await supabase
    .from("lead_notification_events")
    .select("id")
    .eq("tenant_id", params.tenantId)
    .eq("source", facebookFlowEventSource(params.automationId))
    .eq("external_id", leadgenId)
    .maybeSingle()

  return Boolean(data?.id)
}

export async function findExistingFacebookLead(
  supabase: { from: (table: string) => any },
  params: { tenantId: string; leadgenId: unknown },
): Promise<{ id: string } | null> {
  const leadgenId = asId(params.leadgenId)
  if (!leadgenId || !params.tenantId) return null

  const { data: byColumn } = await supabase
    .from("leads")
    .select("id")
    .eq("tenant_id", params.tenantId)
    .eq("facebook_leadgen_id", leadgenId)
    .limit(1)
    .maybeSingle()
  if (byColumn?.id) return byColumn

  const { data: byNotes } = await supabase
    .from("leads")
    .select("id")
    .eq("tenant_id", params.tenantId)
    .ilike("notes", `%${leadgenId}%`)
    .limit(1)
    .maybeSingle()
  return byNotes?.id ? byNotes : null
}
