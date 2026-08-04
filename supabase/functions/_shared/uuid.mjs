/** UUID helpers for actor/user columns that must never receive the literal "system". */

// Accept any RFC-style UUID hex shape (incl. nil UUID). Postgres uuid accepts these.
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Coerce a caller/user id into a real UUID or null.
 * WhatsApp / automation sessions often pass the sentinel string "system",
 * which must not be written into uuid columns (requested_by, approved_by, …).
 */
export function asUuidOrNull(value) {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s || s.toLowerCase() === "system" || s === "null" || s === "undefined") return null;
  return UUID_RE.test(s) ? s : null;
}
