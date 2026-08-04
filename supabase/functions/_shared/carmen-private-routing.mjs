/**
 * Private WhatsApp Carmen routing helpers.
 *
 * Manus often delivers private messages as opaque @lid IDs. Resolving those LIDs
 * must be DETERMINISTIC (real phone in payload, wa_lid_map, or configured
 * carmen_lid_aliases). Never attribute an inbound LID to "whoever had the most
 * recent Carmen session" when multiple phones are authorized — that hijacks
 * Ana's private DMs into David's chat.
 */

export function digitsOnly(value) {
  return String(value || "").replace(/\D/g, "");
}

export function phoneTail9(value) {
  const d = digitsOnly(value);
  return d.length >= 9 ? d.slice(-9) : d;
}

export function phonesMatch(a, b) {
  const ta = phoneTail9(a);
  const tb = phoneTail9(b);
  if (!ta || !tb) return false;
  return ta === tb || digitsOnly(a).endsWith(tb) || digitsOnly(b).endsWith(ta);
}

export function isPhoneInAllowedList(phone, allowedPhones) {
  const list = Array.isArray(allowedPhones) ? allowedPhones.map(digitsOnly).filter(Boolean) : [];
  if (!list.length) return false;
  return list.some((p) => phonesMatch(phone, p));
}

/**
 * Resolve an inbound @lid private sender to a real phone.
 * Priority (deterministic only):
 *  0) payload real-phone field (senderPn / participantPn / …)
 *  1) carmen_lid_aliases[lid]
 *  2) wa_lid_map.phone for this lid
 *  3) single allowed phone (only when exactly one number is authorized)
 *
 * Explicitly does NOT use "most recent active session" when multiple phones
 * are allowed — that was the Ana→David private-chat bug.
 *
 * @returns {{ phone: string|null, reason: string }}
 */
export function resolveInboundLidToPhone({
  lidDigits,
  payloadRealPhone = null,
  lidAliases = null,
  waLidMapPhone = null,
  allowedPhones = [],
} = {}) {
  const lid = digitsOnly(lidDigits);
  const allowed = Array.isArray(allowedPhones)
    ? [...new Set(allowedPhones.map(digitsOnly).filter(Boolean))]
    : [];

  const fromPayload = digitsOnly(payloadRealPhone);
  if (fromPayload && fromPayload.length >= 9 && fromPayload.length <= 15 && fromPayload !== lid) {
    return { phone: fromPayload, reason: "payload_real_phone" };
  }

  const aliases =
    lidAliases && typeof lidAliases === "object" && !Array.isArray(lidAliases) ? lidAliases : {};
  if (lid && aliases[lid]) {
    const mapped = digitsOnly(aliases[lid]);
    if (mapped) return { phone: mapped, reason: "configured_lid_alias" };
  }

  const fromMap = digitsOnly(waLidMapPhone);
  if (fromMap && fromMap.length >= 9) {
    return { phone: fromMap, reason: "wa_lid_map" };
  }

  if (allowed.length === 1) {
    return { phone: allowed[0], reason: "single_allowed_phone" };
  }

  return { phone: null, reason: "unresolved_multi_allowed" };
}

/**
 * After resolving an inbound LID to a phone, the message remains INBOUND from
 * that person. Never flip to "manual outgoing" — that made Ana's DMs look like
 * David's outbound and kept replies on David's thread.
 */
export function shouldMarkResolvedLidAsOutgoing() {
  return false;
}

/**
 * Pick the WhatsApp chat Carmen should reply into for a private message.
 * - Paired Green-API operator mirrors: reply to the operator phone
 * - Otherwise: always the counterpart (originating chat) — never David fallback
 */
export function pickPrivateCarmenTarget({
  pairedFromGreenApi = false,
  sourcePhoneNumber = null,
  counterpartPhone = null,
  isOutgoingFromPhone = false,
} = {}) {
  const counterpart = digitsOnly(counterpartPhone);
  const source = digitsOnly(sourcePhoneNumber);

  if (pairedFromGreenApi && source) {
    return { phone: source, chatId: `${source}@c.us`, reason: "paired_green_api_operator" };
  }

  // Outbound from the connected phone to a third party: reply stays in that
  // counterpart chat (only when outbound-third-party guard already allowed it).
  if (isOutgoingFromPhone && counterpart) {
    return { phone: counterpart, chatId: `${counterpart}@c.us`, reason: "outbound_counterpart" };
  }

  if (counterpart) {
    return { phone: counterpart, chatId: `${counterpart}@c.us`, reason: "inbound_counterpart" };
  }

  return { phone: null, chatId: null, reason: "missing_counterpart" };
}

/**
 * Outbound-to-third-party guard (David's Manus phone messaging Ana/etc.).
 * Returns 'skip' when Carmen must not respond.
 */
export function outboundThirdPartyGuardDecision({
  isOutgoingFromPhone,
  pairedFromGreenApi,
  isGroup,
  messageText,
  hasActiveSessionForChat,
} = {}) {
  if (!isOutgoingFromPhone || pairedFromGreenApi || isGroup) return "continue";
  const msgPrefix = String(messageText || "")
    .toLowerCase()
    .replace(/^\s*🎤\s*/u, "")
    .trim()
    .slice(0, 80);
  const hasOwnerTrigger = /[כק]א?רמן|carmen|קלוד|claude/i.test(msgPrefix);
  if (hasOwnerTrigger) return "continue";
  if (hasActiveSessionForChat) return "continue";
  return "skip";
}

export function buildPrivateRoutingAcceptanceCases() {
  return {
    anaPhone: "972545612156",
    davidPhone: "972507677613",
    anaLid: "999888777666555",
    unauthorizedPhone: "972501111111",
  };
}
