export type TeamMemberCandidate = {
  id: string;
  full_name?: string | null;
  email?: string | null;
  active?: boolean | null;
  created_at?: string | null;
};

const PLACEHOLDER_NAMES = new Set(["קמפיינר", "איש מכירות", "איש צוות"]);

export function normalizePersonName(value?: string | null): string {
  return (value || "").trim().replace(/\s+/g, " ").toLocaleLowerCase("he");
}

export function emailsCompatible(left?: string | null, right?: string | null): boolean {
  const a = (left || "").trim().toLowerCase();
  const b = (right || "").trim().toLowerCase();
  if (!a || !b) return true;
  return a === b;
}

function isMatchableName(value?: string | null): boolean {
  const name = normalizePersonName(value);
  return name.length > 0 && !PLACEHOLDER_NAMES.has(name);
}

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
 * Prefer an existing team-member row over inserting another card.
 * Email wins. A same-name row is reused only when emails are empty or equal,
 * so two different people who share a name stay separate.
 */
export function pickExistingTeamMember<T extends TeamMemberCandidate>(
  candidates: readonly T[],
  identity: { email?: string | null; fullName?: string | null },
): T | null {
  const email = (identity.email || "").trim().toLowerCase();
  const ranked = [...candidates].sort(byPreferredRecord);

  if (email) {
    const byEmail = ranked.find((row) => (row.email || "").trim().toLowerCase() === email);
    if (byEmail) return byEmail;
  }

  if (!isMatchableName(identity.fullName)) return null;
  const name = normalizePersonName(identity.fullName);
  return (
    ranked.find(
      (row) =>
        isMatchableName(row.full_name) &&
        normalizePersonName(row.full_name) === name &&
        emailsCompatible(row.email, email),
    ) || null
  );
}
