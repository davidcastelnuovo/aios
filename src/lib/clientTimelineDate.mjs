/** Normalize optional date form input to DB null (empty string clears the field). */
export function normalizeOptionalClientDate(value) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed === "" ? null : trimmed;
}
