export type TeamMemberCandidate = {
  id: string;
  full_name?: string | null;
  email?: string | null;
  active?: boolean | null;
  created_at?: string | null;
};

function byPreferredRecord(a: TeamMemberCandidate, b: TeamMemberCandidate): number {
  const aActive = a.active === false ? 1 : 0;
  const bActive = b.active === false ? 1 : 0;
  if (aActive !== bActive) return aActive - bActive;
  const aTime = a.created_at || "";
  const bTime = b.created_at || "";
  if (aTime === bTime) return 0;
  return aTime < bTime ? -1 : 1;
}

/**
 * Reuse a team-member card only when it already has this user's email.
 * The same display name is not the same person. An explicit assignment
 * (profiles.campaigner_id or the selected team member) is handled by the caller
 * and always wins over this lookup.
 */
export function pickExistingTeamMember<T extends TeamMemberCandidate>(
  candidates: readonly T[],
  identity: { email?: string | null; fullName?: string | null },
): T | null {
  const email = (identity.email || "").trim().toLowerCase();
  if (!email) return null;
  const ranked = [...candidates].sort(byPreferredRecord);
  return ranked.find((row) => (row.email || "").trim().toLowerCase() === email) || null;
}
