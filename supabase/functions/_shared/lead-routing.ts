const CONTACT_FIELD_NAMES = new Set([
  "full_name",
  "first_name",
  "last_name",
  "name",
  "שם",
  "email",
  "email_address",
  "אימייל",
  "phone",
  "phone_number",
  "mobile",
  "טלפון",
  "company",
  "company_name",
  "חברה",
]);

/** Routing / envelope keys that must never appear under "שאלות סינון". */
const ROUTING_FIELD_NAMES = new Set([
  "client_id",
  "client_name",
  "client_phone",
  "client_email",
  "client_whatsapp_group_id",
  "lead_id",
  "lead_name",
  "lead_phone",
  "lead_email",
  "lead_company",
  "contact_name",
  "company_name",
  "details",
  "source",
  "external_id",
  "leadgen_id",
  "form_id",
  "facebook_form_id",
  "raw_payload",
  "form_data",
  "form_qa_summary",
  "questions_and_answers",
  "answers",
  "field_data",
  "recipient_name",
  "recipient_phone",
  "recipient_email",
]);

export type LeadClientContext = {
  client_id: string;
  client_name: string;
  client_phone: string;
  client_email: string;
  client_whatsapp_group_id: string;
};

export function isScreeningQuestionKey(key: string): boolean {
  const normalized = key.trim().toLowerCase();
  if (!normalized) return false;
  if (CONTACT_FIELD_NAMES.has(normalized)) return false;
  if (ROUTING_FIELD_NAMES.has(normalized)) return false;
  if (normalized.startsWith("fb_")) return false;
  return true;
}

/**
 * Parse a Make/Zapier free-text Q&A blob such as
 * "הגעה לראשון לציון?: כן • ניסיון במכירות?: לא" into question → answer pairs.
 */
export function parseQaText(value: string): Record<string, string> {
  const text = String(value ?? "").trim();
  if (!text) return {};

  const chunks = text
    .split(/\s*[•\n\r|;]+\s*/)
    .map((part) => part.trim())
    .filter(Boolean);

  const out: Record<string, string> = {};
  for (const chunk of chunks) {
    const match = chunk.match(/^([^:：]+)\s*[:：]\s*(.+)$/);
    if (!match) continue;
    const question = match[1].trim();
    const answer = match[2].trim();
    if (!question || !answer) continue;
    if (!isScreeningQuestionKey(question)) continue;
    out[question] = answer;
  }
  return out;
}

export function filterScreeningAnswers(fieldData: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(fieldData).filter(([key, value]) =>
      Boolean(value?.trim()) && isScreeningQuestionKey(key)
    ),
  );
}

/**
 * Builds the screening-questions block for lead alerts.
 * Only dynamic question → answer pairs; never repeats client/lead contact fields.
 * Joined with " • " because Meta template parameters cannot contain newlines.
 */
export function buildFormQaSummary(fieldData: Record<string, string>): string {
  return Object.entries(filterScreeningAnswers(fieldData))
    .map(([key, value]) => `${key}: ${value.trim()}`)
    .join(" • ");
}

export function buildFacebookFields(fieldData: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(fieldData).map(([key, value]) => [`fb_${key.replace(/\s+/g, "_")}`, value]),
  );
}

export async function resolveLeadClient(
  supabase: any,
  tenantId: string,
  clientId: unknown,
): Promise<LeadClientContext | null> {
  if (typeof clientId !== "string" || !clientId) return null;

  const { data: client, error } = await supabase
    .from("clients")
    .select("id,name,contact_name,phone,email,whatsapp_group_id")
    .eq("id", clientId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw error;
  if (!client) return null;

  let phone = String(client.phone ?? "");
  let email = String(client.email ?? "");
  if (!phone || !email) {
    const { data: primaryContact } = await supabase
      .from("client_contacts")
      .select("phone,email")
      .eq("client_id", client.id)
      .eq("is_primary", true)
      .maybeSingle();
    phone ||= String(primaryContact?.phone ?? "");
    email ||= String(primaryContact?.email ?? "");
  }

  return {
    client_id: String(client.id),
    client_name: String(client.name ?? client.contact_name ?? ""),
    client_phone: phone,
    client_email: email,
    client_whatsapp_group_id: String(client.whatsapp_group_id ?? ""),
  };
}

export function buildLeadRoutingPayload(
  client: LeadClientContext | null,
  formData: Record<string, string>,
) {
  const screening = filterScreeningAnswers(formData);
  return {
    ...(client ?? {
      client_id: "",
      client_name: "",
      client_phone: "",
      client_email: "",
      client_whatsapp_group_id: "",
    }),
    form_data: screening,
    form_qa_summary: buildFormQaSummary(screening),
    ...buildFacebookFields(screening),
  };
}
