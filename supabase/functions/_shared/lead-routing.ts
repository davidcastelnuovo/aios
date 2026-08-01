const CONTACT_FIELD_NAMES = new Set([
  "full_name",
  "first_name",
  "last_name",
  "name",
  "email",
  "email_address",
  "phone",
  "phone_number",
  "company",
  "company_name",
]);

export type LeadClientContext = {
  client_id: string;
  client_name: string;
  client_phone: string;
  client_email: string;
  client_whatsapp_group_id: string;
};

export function buildFormQaSummary(fieldData: Record<string, string>): string {
  return Object.entries(fieldData)
    .filter(([key, value]) => value?.trim() && !CONTACT_FIELD_NAMES.has(key.toLowerCase()))
    .map(([key, value]) => `• ${key}: ${value.trim()}`)
    .join("\n");
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
  return {
    ...(client ?? {
      client_id: "",
      client_name: "",
      client_phone: "",
      client_email: "",
      client_whatsapp_group_id: "",
    }),
    form_data: formData,
    form_qa_summary: buildFormQaSummary(formData),
    ...buildFacebookFields(formData),
  };
}
