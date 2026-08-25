/** Restore an archived lead when a new inbound contact matches its phone/email. */
export function unarchiveExistingLead(
  existing: { archived_at?: string | null } | null | undefined,
  updates: Record<string, unknown>,
): boolean {
  if (!existing?.archived_at) return false;
  updates.archived_at = null;
  updates.archived_by = null;
  return true;
}
