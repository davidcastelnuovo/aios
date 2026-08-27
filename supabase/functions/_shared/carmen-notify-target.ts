/**
 * Resolve who should receive Carmen outbound notify / pulse digests.
 *
 * Hard rules:
 *  - never fall back to a phone that is not an active campaigner on this tenant
 *    (blocks MarketingCaptain owner David from receiving DMM digests just
 *    because he has the newest carmen_whatsapp_sessions row).
 *  - never deliver pulse / coding-agent / health notifies to a WhatsApp group.
 *    Group session rows store the last speaker's phone, so a live group chat
 *    would otherwise steal David's private 1:1 destination.
 */

export type NotifySessionCandidate = {
  chat_id: string;
  phone?: string | null;
  contact_name?: string | null;
  sender_name?: string | null;
  updated_at?: string | null;
};

/** Session row used to wire notify delivery (automation + connection user). */
export type NotifyBridgeSession = NotifySessionCandidate & {
  automation_id?: string | null;
  connection_user_id?: string | null;
};

export type NotifyStaffCandidate = {
  phone: string | null;
  full_name: string | null;
  /** campaigners.role entry, identity role_title, or tenant role string */
  role?: string | null;
};

export type ResolveCarmenNotifyTargetInput = {
  /** Explicit chat_id / phone from the caller (highest priority). */
  preferredPhone?: string | null;
  /** tenant_heartbeat_settings.campaign_pulse_phone */
  campaignPulsePhone?: string | null;
  /** Non-group carmen_whatsapp_sessions for the tenant (newest first preferred). */
  sessions: NotifySessionCandidate[];
  /** Active tenant campaigners with phones (this tenant only). */
  staff: NotifyStaffCandidate[];
};

export type ResolveCarmenNotifyTargetResult = {
  chatId: string;
  phone: string;
  contactName: string | null;
  source:
    | "preferred_phone"
    | "campaign_pulse_phone"
    | "tenant_staff_session"
    | "tenant_staff_phone"
    | "none";
  reason?: string;
};

/** Normalize Israeli / international WhatsApp digits for comparison. */
export function normalizeNotifyPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  // Strip WhatsApp JID suffix (@c.us / @g.us / @lid)
  const local = String(raw).trim().split("@")[0] ?? "";
  let digits = local.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("0") && digits.length >= 9) {
    digits = `972${digits.slice(1)}`;
  }
  if (digits.startsWith("9720")) {
    digits = `972${digits.slice(4)}`;
  }
  return digits;
}

export function phonesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizeNotifyPhone(a);
  const nb = normalizeNotifyPhone(b);
  if (!na || !nb) return false;
  return na === nb || na.endsWith(nb) || nb.endsWith(na);
}

/** WhatsApp group JIDs must never be used as a 1:1 notify / pulse destination. */
export function isGroupChatId(chatId: string | null | undefined): boolean {
  return String(chatId || "").toLowerCase().includes("@g.us");
}

export function isManagerStaffRole(role: string | null | undefined): boolean {
  if (!role) return false;
  const r = String(role).toLowerCase();
  return (
    r.includes("manager") ||
    r.includes("מנהל") ||
    r === "owner" ||
    r === "admin" ||
    r === "agency_owner" ||
    r === "team_manager" ||
    r === "super_admin"
  );
}

function staffSortKey(s: NotifyStaffCandidate): number {
  return isManagerStaffRole(s.role) ? 0 : 1;
}

function findSessionForPhone(
  sessions: NotifySessionCandidate[],
  phone: string,
): NotifySessionCandidate | null {
  // Group rows store the last speaker's phone (David chatting in AfterLead-DMM).
  // Matching on phone alone would steal private pulse/notify into that group.
  return (
    sessions.find((s) => {
      if (isGroupChatId(s.chat_id)) return false;
      return phonesMatch(s.chat_id, phone) || phonesMatch(s.phone, phone);
    }) ?? null
  );
}

/**
 * Pick the 1:1 chat to send a notify/pulse to.
 * Group sessions may still supply automation wiring, but the destination is
 * always the private phone — never the freshest @g.us row.
 */
export function pickNotifyDelivery(
  sessions: NotifyBridgeSession[],
  target: Pick<ResolveCarmenNotifyTargetResult, "chatId" | "phone">,
): {
  chatId: string;
  phoneNumber: string;
  isGroup: false;
  matchedSession: NotifyBridgeSession | null;
  bridgeSession: NotifyBridgeSession | null;
} {
  const phone = normalizeNotifyPhone(target.phone) || "";
  const matchedSession = (findSessionForPhone(sessions, phone) as NotifyBridgeSession | null) ?? null;
  const bridgeSession =
    (matchedSession?.automation_id ? matchedSession : null) ||
    sessions.find((s) => !!s.automation_id) ||
    null;
  const fromTarget = isGroupChatId(target.chatId) ? phone : (target.chatId || phone);
  const chatId = matchedSession?.chat_id || fromTarget;
  return {
    chatId: isGroupChatId(chatId) ? phone : chatId,
    phoneNumber: normalizeNotifyPhone(matchedSession?.phone) || phone,
    isGroup: false,
    matchedSession,
    bridgeSession,
  };
}

function contactNameFor(
  session: NotifySessionCandidate | null,
  staff: NotifyStaffCandidate[],
  phone: string,
): string | null {
  return (
    session?.contact_name ||
    session?.sender_name ||
    staff.find((s) => phonesMatch(s.phone, phone))?.full_name ||
    null
  );
}

/**
 * Resolve the WhatsApp chat that should receive a Carmen notify / pulse update.
 */
export function resolveCarmenNotifyTarget(
  input: ResolveCarmenNotifyTargetInput,
): ResolveCarmenNotifyTargetResult {
  const sessions = input.sessions ?? [];
  const staff = [...(input.staff ?? [])]
    .filter((s) => !!normalizeNotifyPhone(s.phone))
    .sort((a, b) => staffSortKey(a) - staffSortKey(b));
  const staffPhones = staff
    .map((s) => normalizeNotifyPhone(s.phone))
    .filter((p): p is string => !!p);

  const tryPhone = (
    phoneRaw: string | null | undefined,
    source: ResolveCarmenNotifyTargetResult["source"],
  ): ResolveCarmenNotifyTargetResult | null => {
    const phone = normalizeNotifyPhone(phoneRaw);
    if (!phone) return null;
    // Never treat a group JID as a private notify target
    if (String(phoneRaw || "").includes("@g.us")) return null;
    const session = findSessionForPhone(sessions, phone);
    const chatId = isGroupChatId(session?.chat_id) ? phone : (session?.chat_id ?? phone);
    return {
      chatId,
      phone: normalizeNotifyPhone(session?.phone) ?? phone,
      contactName: contactNameFor(session, staff, phone),
      source,
    };
  };

  const preferred = tryPhone(input.preferredPhone, "preferred_phone");
  if (preferred) return preferred;

  const pulse = tryPhone(input.campaignPulsePhone, "campaign_pulse_phone");
  if (pulse) return pulse;

  // Prefer a session whose chat belongs to a tenant campaigner.
  // Managers (מנהל צוות) win over regular campaigners when both have sessions.
  const rankedStaffPhones = [
    ...staff.filter((s) => isManagerStaffRole(s.role)).map((s) => normalizeNotifyPhone(s.phone)!),
    ...staff.filter((s) => !isManagerStaffRole(s.role)).map((s) => normalizeNotifyPhone(s.phone)!),
  ];

  for (const staffPhone of rankedStaffPhones) {
    const session = findSessionForPhone(sessions, staffPhone);
    if (!session) continue;
    return {
      chatId: session.chat_id,
      phone: normalizeNotifyPhone(session.phone) ?? staffPhone,
      contactName: contactNameFor(session, staff, staffPhone),
      source: "tenant_staff_session",
    };
  }

  // No matching session — use first manager/campaigner phone (managers first).
  const firstStaffPhone = staffPhones[0];
  if (firstStaffPhone) {
    return {
      chatId: firstStaffPhone,
      phone: firstStaffPhone,
      contactName: staff.find((s) => phonesMatch(s.phone, firstStaffPhone))?.full_name ?? null,
      source: "tenant_staff_phone",
    };
  }

  return {
    chatId: "",
    phone: "",
    contactName: null,
    source: "none",
    reason:
      "No preferred phone, campaign_pulse_phone, or tenant campaigner session/phone found — refusing cross-tenant owner fallback",
  };
}
