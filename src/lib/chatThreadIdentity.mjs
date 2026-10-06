/**
 * WhatsApp identifies a conversation by phone number, while CRM messages may
 * additionally carry a lead_id or client_id. Build one identity filter so the
 * same thread is rendered from Chat, Leads, and Clients.
 */
export function normalizeChatThreadPhone(phone) {
  const raw = String(phone ?? "").trim();
  // A UUID (lead/client id) must never be treated as a phone number, otherwise
  // its digits would match an unrelated conversation.
  if (/[a-zA-Z]/.test(raw)) return "";

  const digits = raw.replace(/\D/g, "").replace(/^00/, "");
  const withoutCountryCode = digits.startsWith("972") ? digits.slice(3) : digits;
  const local = withoutCountryCode.replace(/^0/, "");
  return local.length >= 9 ? local.slice(-9) : "";
}

export function buildChatThreadFilter({ contactId, contactType, phone }) {
  if (contactType === "group") return `group_id.eq.${contactId}`;

  const phoneTail = normalizeChatThreadPhone(phone);
  const phoneFilter = phoneTail ? `sender_phone.ilike.%${phoneTail}` : "";

  if (contactType === "unknown") return phoneFilter;

  const entityColumn = contactType === "client" ? "client_id" : "lead_id";
  return [
    `${entityColumn}.eq.${contactId}`,
    phoneFilter,
  ].filter(Boolean).join(",");
}
