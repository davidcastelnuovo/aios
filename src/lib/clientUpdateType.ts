const NEGATED_CLIENT_CALL_PATTERNS = [
  /(?:לא|טרם|עוד לא)\s+(?:הצלח(?:תי|נו)\s+)?(?:לדבר|דיבר(?:תי|נו|ה)?|שוחח(?:תי|נו|ה)?)/i,
  /(?:אין|לא היה)\s+מענה/i,
  /(?:הלקוח|הלקוחה)\s+לא\s+ענ(?:ה|תה)/i,
];

const COMPLETED_CLIENT_CALL_PATTERNS = [
  /(?:דיבר(?:תי|נו|ה)?|שוחח(?:תי|נו|ה)?)\s+(?:טלפונית\s+|בטלפון\s+)?עם\s+(?:ה)?לקוח(?:ה)?/i,
  /(?:דיבר(?:תי|נו|ה)?|שוחח(?:תי|נו|ה)?).{0,30}(?:טלפונית|בטלפון)/i,
  /(?:טלפונית|בטלפון).{0,30}(?:דיבר(?:תי|נו|ה)?|שוחח(?:תי|נו|ה)?)/i,
  /(?:שיחה טלפונית|שיחת טלפון).{0,30}(?:עם\s+)?(?:ה)?לקוח(?:ה)?/i,
  /בוצעה\s+שיחה.{0,20}(?:עם\s+)?(?:ה)?לקוח(?:ה)?/i,
];

/** True only for an affirmative note that documents a completed client call. */
export function describesCompletedClientPhoneCall(content: string): boolean {
  const normalized = content.replace(/\s+/g, " ").trim();
  if (!normalized) return false;
  if (NEGATED_CLIENT_CALL_PATTERNS.some((pattern) => pattern.test(normalized))) return false;
  return COMPLETED_CLIENT_CALL_PATTERNS.some((pattern) => pattern.test(normalized));
}

/**
 * A weekly update that documents a completed phone call is stored as `call`, so
 * the client card and Carmen's pulse use the same structured source of truth.
 */
export function resolveClientUpdateType(selectedType: string, content: string): string {
  if (selectedType === "weekly_update" && describesCompletedClientPhoneCall(content)) return "call";
  return selectedType;
}

/** Whether a client_updates row counts as a documented client phone call for pulse. */
export function isClientCallUpdate(updateType: string | null | undefined, content: string): boolean {
  if (updateType === "call") return true;
  if (updateType === "weekly_update") return describesCompletedClientPhoneCall(content);
  return false;
}
