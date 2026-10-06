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
 * True when a value is a real phone number rather than a WhatsApp LID.
 * Manus LIDs are long opaque ids (14+ digits); real Israeli mobiles are at most
 * 13 digits and their last 9 start with 5-9.
 */
export function looksLikeRealPhone(value) {
  const d = digitsOnly(value);
  if (!d || d.length > 13) return false;
  return /^[5-9]\d{8}$/.test(phoneTail9(d));
}

/**
 * A `wa_lid_map.lid` key is only trustworthy when it cannot be a real phone.
 * The gateway often puts the REAL phone in `from` / `senderPhone` while flagging
 * the chat as `@lid`; keying the map by that value stored phone→phone rows
 * (David's own number → the connected bot number), which then re-attributed all
 * of his later messages and made Carmen refuse them with `scope_phone`.
 */
export function isUsableLidKey(value) {
  const d = digitsOnly(value);
  if (d.length < 9) return false;
  return !looksLikeRealPhone(d);
}

/** LID digits of an inbound private event — taken only from LID-bearing fields. */
export function pickInboundLidDigits({ fromRaw = "", chatIdRaw = "", senderLidRaw = "" } = {}) {
  const senderLid = digitsOnly(senderLidRaw);
  if (isUsableLidKey(senderLid)) return senderLid;
  for (const raw of [fromRaw, chatIdRaw]) {
    if (!/@lid$/i.test(String(raw || ""))) continue;
    const d = digitsOnly(String(raw).split("@")[0]);
    if (isUsableLidKey(d)) return d;
  }
  return "";
}

/**
 * First real phone among the gateway's phone fields, ignoring the LID itself.
 * Israeli-shaped numbers win; other international numbers are still accepted.
 */
export function pickPayloadRealPhone(candidates = [], lidDigits = "") {
  const lid = digitsOnly(lidDigits);
  const fallbacks = [];
  for (const candidate of Array.isArray(candidates) ? candidates : []) {
    const d = digitsOnly(String(candidate || "").split("@")[0]);
    if (!d || d === lid) continue;
    if (looksLikeRealPhone(d)) return d;
    if (d.length >= 9 && d.length <= 15) fallbacks.push(d);
  }
  return fallbacks[0] || "";
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

  // Defensive: the "LID" is sometimes the sender's real phone (gateway puts it in
  // `from` while marking the chat @lid). It resolves to itself — never through the
  // map or the single-allowed-phone fallback, which caused cross-attribution.
  if (looksLikeRealPhone(lid)) {
    return { phone: lid, reason: "lid_is_real_phone" };
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
    davidLid: "224686986293269",
    botPhone: "972549696673",
    unauthorizedPhone: "972501111111",
  };
}
