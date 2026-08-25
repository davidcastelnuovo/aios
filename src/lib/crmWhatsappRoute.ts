export type CrmWhatsappProvider =
  | "green_api"
  | "manus_wa"
  | "meta_whatsapp"
  | "manychat";

export type CrmWhatsappIntegration = {
  id: string;
  integration_type: string;
  user_id?: string | null;
};

const WA_ORDER: CrmWhatsappProvider[] = [
  "green_api",
  "manus_wa",
  "meta_whatsapp",
  "manychat",
];

export function pickCrmWhatsappIntegration(
  preferred: string | null | undefined,
  integrations: readonly CrmWhatsappIntegration[] | null | undefined,
): { id: string; type: CrmWhatsappProvider; user_id: string | null } | null {
  const list = integrations || [];
  if (list.length === 0) return null;

  const asProvider = (type: string): CrmWhatsappProvider | null =>
    WA_ORDER.includes(type as CrmWhatsappProvider)
      ? (type as CrmWhatsappProvider)
      : null;

  if (preferred) {
    const match = list.find((row) => row.integration_type === preferred);
    const type = match ? asProvider(match.integration_type) : null;
    if (match && type) {
      return { id: match.id, type, user_id: match.user_id ?? null };
    }
  }

  for (const type of WA_ORDER) {
    const match = list.find((row) => row.integration_type === type);
    if (match) {
      return { id: match.id, type, user_id: match.user_id ?? null };
    }
  }
  return null;
}

export function crmWhatsappFunctionName(type: CrmWhatsappProvider): string {
  if (type === "manus_wa") return "send-manus-wa-message";
  if (type === "meta_whatsapp") return "send-meta-whatsapp-message";
  if (type === "manychat") return "send-chat-message";
  return "send-green-api-message";
}
