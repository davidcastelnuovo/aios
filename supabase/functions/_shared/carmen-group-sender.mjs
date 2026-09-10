/** Last 9 digits — shared phone matching policy for Carmen group auth. */
export function phoneTail(value) {
  return String(value || '').replace(/\D/g, '').slice(-9);
}

/** True when two phone strings refer to the same subscriber (tail match). */
export function phonesMatch(a, b) {
  const da = String(a || '').replace(/\D/g, '');
  const db = String(b || '').replace(/\D/g, '');
  if (!da || !db) return false;
  if (da === db) return true;
  const ta = phoneTail(da);
  const tb = phoneTail(db);
  return !!ta && !!tb && (ta === tb || da.endsWith(db) || db.endsWith(da));
}

/**
 * Resolve the real participant phone for a WhatsApp group message.
 * Never return the group JID digits — those are not a sender identity.
 */
export function resolveGroupParticipantPhone({
  groupChatId,
  phoneNumber,
  sourcePhoneNumber,
  senderWid,
  selfWid,
  isOutgoing,
}) {
  const groupDigits = String(groupChatId || '').split('@')[0].replace(/\D/g, '');
  const participantWid = isOutgoing ? (selfWid || senderWid) : (senderWid || selfWid);
  const fromWid = participantWid
    ? String(participantWid).split('@')[0].replace(/\D/g, '')
    : '';
  const candidates = [
    fromWid,
    String(sourcePhoneNumber || '').replace(/\D/g, ''),
    String(phoneNumber || '').replace(/\D/g, ''),
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (candidate !== groupDigits && phoneTail(candidate).length >= 9) {
      return candidate;
    }
  }
  return null;
}

/** Context block injected into Carmen's prompt for group turns. */
export function buildGroupSenderContextNote(phone, senderName) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) {
    return '\n\n[שולח בקבוצה] participant_phone לא זוהה — אין להסתמך על group_id או display name לזיהוי.';
  }
  const namePart = senderName ? `, sender_name=${senderName}` : '';
  return `\n\n[שולח בקבוצה] participant_phone=${digits}${namePart}. אין להסתמך על group_id או display name לזיהוי — רק participant_phone.`;
}

/**
 * Private-list phones (carmen_allowed_phones) grant group access ONLY to tenant managers.
 * Non-managers (e.g. Ana) stay blocked in groups unless carmen_whatsapp_identities approves them.
 */
export function managerGroupAccessViaAllowedPhones({ phoneDigits, allowedPhones, isManager }) {
  if (!isManager || !phoneDigits) return false;
  const allowed = (Array.isArray(allowedPhones) ? allowedPhones : [])
    .map((p) => String(p).replace(/\D/g, ''))
    .filter(Boolean);
  return allowed.some((p) => phonesMatch(phoneDigits, p));
}
