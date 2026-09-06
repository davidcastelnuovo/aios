/** Idempotency for Facebook Instant Form → automation WhatsApp sends. */

const asId = (value: unknown): string => String(value ?? "").trim()
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const asUuid = (value: unknown): string | null => {
  const id = asId(value)
  return UUID_RE.test(id) ? id : null
}

export const facebookFlowEventSource = (automationId: string) => `fb-flow:${automationId}`
export const facebookIntakeEventSource = () => "fb-intake"

/** Stable per-destination lock key so 0546… / 972546… / …@c.us share one receipt. */
export function facebookWhatsAppSendSource(chatId: string): string {
  const raw = asId(chatId)
  if (raw.includes("@g.us")) return `fb-wa:${raw}`
  const digits = raw.replace(/\D/g, "")
  const last9 = digits.slice(-9)
  return `fb-wa:${last9 ? `972${last9}@c.us` : raw}`
}

/** Same destination key, but for identical message-body locks that do not need a leadgen id. */
export function whatsAppBodyEventSource(chatId: string): string {
  return facebookWhatsAppSendSource(chatId).replace(/^fb-wa:/, "wa-body:")
}

export function shouldLockWhatsAppBody(message: unknown, leadgenId?: unknown): boolean {
  if (asId(leadgenId)) return true
  return /^\s*ליד חדש/.test(String(message ?? ""))
}

export async function hashWhatsAppBody(message: unknown): Promise<string> {
  const text = asId(message)
  if (!text) return ""
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")
}

function isUniqueViolation(error: { code?: unknown; message?: unknown; details?: unknown } | null | undefined): boolean {
  if (!error) return false
  const code = String(error.code ?? "")
  const text = `${error.message ?? ""} ${error.details ?? ""}`
  return code === "23505" || code === "409" || /duplicate key|unique constraint/i.test(text)
}

export async function claimFacebookLeadIntake(
  supabase: { from: (table: string) => any },
  params: { tenantId: string; leadgenId: unknown; formId?: unknown },
): Promise<{ duplicate: boolean; inserted: boolean }> {
  const leadgenId = asId(params.leadgenId)
  if (!leadgenId || !params.tenantId) return { duplicate: false, inserted: false }

  const { error } = await supabase.from("lead_notification_events").insert({
    tenant_id: params.tenantId,
    source: facebookIntakeEventSource(),
    external_id: leadgenId,
    form_id: asId(params.formId) || null,
  })

  if (isUniqueViolation(error)) return { duplicate: true, inserted: false }
  if (error) {
    console.error("[facebook-lead-dedup] intake claim failed:", error.message)
    const { data } = await supabase
      .from("lead_notification_events")
      .select("id")
      .eq("tenant_id", params.tenantId)
      .eq("source", facebookIntakeEventSource())
      .eq("external_id", leadgenId)
      .maybeSingle()
    if (data?.id) return { duplicate: true, inserted: false }
    return { duplicate: false, inserted: false }
  }
  return { duplicate: false, inserted: true }
}

export async function wasFacebookLeadIntakeClaimed(
  supabase: { from: (table: string) => any },
  params: { tenantId: string; leadgenId: unknown },
): Promise<boolean> {
  const leadgenId = asId(params.leadgenId)
  if (!leadgenId || !params.tenantId) return false

  const { data } = await supabase
    .from("lead_notification_events")
    .select("id")
    .eq("tenant_id", params.tenantId)
    .eq("source", facebookIntakeEventSource())
    .eq("external_id", leadgenId)
    .maybeSingle()

  return Boolean(data?.id)
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
): Promise<{ duplicate: boolean; inserted: boolean }> {
  const leadgenId = asId(params.leadgenId)
  if (!leadgenId || !params.tenantId || !params.automationId) {
    return { duplicate: false, inserted: false }
  }

  const { error } = await supabase.from("lead_notification_events").insert({
    tenant_id: params.tenantId,
    source: facebookFlowEventSource(params.automationId),
    external_id: leadgenId,
    form_id: asId(params.formId) || null,
    client_id: asUuid(params.clientId),
  })

  if (isUniqueViolation(error)) return { duplicate: true, inserted: false }
  if (error) {
    console.error("[facebook-lead-dedup] claim insert failed:", error.message)
    const already = await wasFacebookLeadAutomationClaimed(supabase, params)
    if (already) return { duplicate: true, inserted: false }
    return { duplicate: false, inserted: false }
  }
  return { duplicate: false, inserted: true }
}

export async function claimFacebookLeadWhatsAppSend(
  supabase: { from: (table: string) => any },
  params: { tenantId: string; chatId: string; leadgenId: unknown },
): Promise<{ duplicate: boolean; inserted: boolean }> {
  const leadgenId = asId(params.leadgenId)
  const chatId = asId(params.chatId)
  if (!leadgenId || !chatId || !params.tenantId) return { duplicate: false, inserted: false }

  const { error } = await supabase.from("lead_notification_events").insert({
    tenant_id: params.tenantId,
    source: facebookWhatsAppSendSource(chatId),
    external_id: leadgenId,
  })

  if (isUniqueViolation(error)) return { duplicate: true, inserted: false }
  if (error) {
    console.error("[facebook-lead-dedup] whatsapp send claim failed:", error.message)
    const { data } = await supabase
      .from("lead_notification_events")
      .select("id")
      .eq("tenant_id", params.tenantId)
      .eq("source", facebookWhatsAppSendSource(chatId))
      .eq("external_id", leadgenId)
      .maybeSingle()
    if (data?.id) return { duplicate: true, inserted: false }
    return { duplicate: false, inserted: false }
  }
  return { duplicate: false, inserted: true }
}

export async function claimIdenticalWhatsAppSend(
  supabase: { from: (table: string) => any },
  params: { tenantId: string; chatId: string; message: unknown; leadgenId?: unknown },
): Promise<{ duplicate: boolean; inserted: boolean }> {
  const chatId = asId(params.chatId)
  const bodyHash = await hashWhatsAppBody(params.message)
  if (!bodyHash || !chatId || !params.tenantId) return { duplicate: false, inserted: false }
  if (!shouldLockWhatsAppBody(params.message, params.leadgenId)) {
    return { duplicate: false, inserted: false }
  }

  const { error } = await supabase.from("lead_notification_events").insert({
    tenant_id: params.tenantId,
    source: whatsAppBodyEventSource(chatId),
    external_id: bodyHash,
  })

  if (isUniqueViolation(error)) return { duplicate: true, inserted: false }
  if (error) {
    console.error("[facebook-lead-dedup] identical whatsapp send claim failed:", error.message)
    const { data } = await supabase
      .from("lead_notification_events")
      .select("id")
      .eq("tenant_id", params.tenantId)
      .eq("source", whatsAppBodyEventSource(chatId))
      .eq("external_id", bodyHash)
      .maybeSingle()
    if (data?.id) return { duplicate: true, inserted: false }
    return { duplicate: false, inserted: false }
  }
  return { duplicate: false, inserted: true }
}

export async function releaseFacebookLeadWhatsAppSend(
  supabase: { from: (table: string) => any },
  params: { tenantId: string; chatId: string; leadgenId: unknown },
): Promise<void> {
  const leadgenId = asId(params.leadgenId)
  const chatId = asId(params.chatId)
  if (!leadgenId || !chatId || !params.tenantId) return

  const { error } = await supabase
    .from("lead_notification_events")
    .delete()
    .eq("tenant_id", params.tenantId)
    .eq("source", facebookWhatsAppSendSource(chatId))
    .eq("external_id", leadgenId)

  if (error) {
    console.error("[facebook-lead-dedup] whatsapp send claim release failed:", error.message)
  }
}

export async function releaseFacebookLeadAutomationRun(
  supabase: { from: (table: string) => any },
  params: { tenantId: string; automationId: string; leadgenId: unknown },
): Promise<void> {
  const leadgenId = asId(params.leadgenId)
  if (!leadgenId || !params.tenantId || !params.automationId) return

  const { error } = await supabase
    .from("lead_notification_events")
    .delete()
    .eq("tenant_id", params.tenantId)
    .eq("source", facebookFlowEventSource(params.automationId))
    .eq("external_id", leadgenId)

  if (error) {
    console.error("[facebook-lead-dedup] claim release failed:", error.message)
  }
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

export function facebookTriggerAutomationSucceeded(body: unknown): boolean {
  if (!body || typeof body !== "object") return false
  const results = (body as { results?: unknown }).results
  if (!Array.isArray(results)) return false
  return results.some((row) =>
    Boolean(row && typeof row === "object" && (row as { success?: boolean }).success === true),
  )
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
