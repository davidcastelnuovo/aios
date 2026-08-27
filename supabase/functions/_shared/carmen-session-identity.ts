/**
 * Carmen WhatsApp session identity.
 *
 * One conversation = one session, keyed ONLY by the WhatsApp chat JID:
 *   private  972507677613@c.us
 *   group    120363425732219862@g.us
 *
 * `phone` on carmen_whatsapp_sessions is the last speaker — metadata, never
 * the conversation key. Looking up by phone (or "newest session") mixes
 * groups: David talking in AfterLead-DMM would steal a reply meant for
 * דוד & דקל & אנה, or steal a private pulse into a live group.
 *
 * Hard rules:
 *  1. Session lookup / history restore require chat_id. Never phone-only.
 *  2. Replies go back to the originating chat_id of that turn.
 *  3. System automations (pulse / health / coding-agent notify) use an
 *     explicit configured phone and never a group JID / live session.
 */

export function isGroupChatId(chatId: string | null | undefined): boolean {
  return String(chatId || "").toLowerCase().includes("@g.us");
}

/** Canonical conversation key, or null if we cannot identify the chat. */
export function normalizeCarmenChatId(raw: string | null | undefined): string | null {
  const v = String(raw || "").trim();
  if (!v) return null;
  const lower = v.toLowerCase();
  if (lower.includes("@g.us") || lower.includes("@c.us") || lower.includes("@lid")) {
    return v;
  }
  const digits = v.replace(/\D/g, "");
  if (digits.length >= 8) return `${digits}@c.us`;
  return null;
}

export function originChatsMatch(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const na = normalizeCarmenChatId(a);
  const nb = normalizeCarmenChatId(b);
  return !!na && !!nb && na === nb;
}

/** Group flag must match the JID type — never send a group reply via a private phone. */
export function replyDestinationIsConsistent(args: {
  chatId: string | null | undefined;
  isGroup: boolean;
}): boolean {
  const chatId = normalizeCarmenChatId(args.chatId);
  if (!chatId) return false;
  return isGroupChatId(chatId) === args.isGroup;
}

/**
 * Session / history queries must have a chat JID. Phone is not a substitute:
 * the same speaker is in many groups.
 */
export function requireOriginChatId(
  chatId: string | null | undefined,
): { ok: true; chatId: string; isGroup: boolean } | { ok: false; reason: string } {
  const normalized = normalizeCarmenChatId(chatId);
  if (!normalized) {
    return { ok: false, reason: "missing_chat_id" };
  }
  return { ok: true, chatId: normalized, isGroup: isGroupChatId(normalized) };
}

export function buildWaNotifyFromOrigin(args: {
  tenantId: string;
  automationId: string | null;
  connectionUserId: string;
  chatId: string;
  speakerPhone?: string | null;
}): {
  surface: "whatsapp";
  tenant_id: string;
  automation_id: string | null;
  connection_user_id: string;
  chat_id: string;
  phone_number: string | null;
  is_group: boolean;
} | null {
  const origin = requireOriginChatId(args.chatId);
  if (!origin.ok) return null;
  return {
    surface: "whatsapp",
    tenant_id: args.tenantId,
    automation_id: args.automationId,
    connection_user_id: args.connectionUserId,
    chat_id: origin.chatId,
    phone_number: args.speakerPhone || null,
    is_group: origin.isGroup,
  };
}
