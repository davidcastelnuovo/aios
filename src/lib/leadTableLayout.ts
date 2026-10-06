export const LEAD_TABLE_LAYOUTS = ["by_user", "by_date"] as const;
export type LeadTableLayout = (typeof LEAD_TABLE_LAYOUTS)[number];

export const UNASSIGNED_LEAD_GROUP_ID = "unassigned";
export const LEAD_TABLE_LAYOUT_STORAGE_KEY = "leads-table-layout";

export type SurfaceSalesPerson = {
  id: string;
  full_name: string;
  agency_id?: string | null;
  agencyIds?: string[] | null;
};

export type LeadTableGroup<T> = {
  id: string;
  label: string;
  leads: T[];
};

export function parseLeadTableLayout(value: string | null | undefined): LeadTableLayout {
  return value === "by_date" ? "by_date" : "by_user";
}

export function isSalesPersonOnSurface(
  person: SurfaceSalesPerson,
  selectedAgency: string | null | undefined,
): boolean {
  if (!selectedAgency || selectedAgency === "all") return true;
  if (person.agency_id === selectedAgency) return true;
  return person.agencyIds?.includes(selectedAgency) ?? false;
}

export function sortLeadsByDate<T extends { created_at?: string | null }>(leads: T[]): T[] {
  return [...leads].sort((a, b) => {
    const ta = a.created_at ? Date.parse(a.created_at) : 0;
    const tb = b.created_at ? Date.parse(b.created_at) : 0;
    return tb - ta;
  });
}

/**
 * Group CRM table leads by the sales people on the current surface (agency).
 * Surface users always appear, even with zero leads. Assignees from other
 * agencies still get a group so their leads are not hidden. Unassigned is last.
 */
export function groupLeadsBySurfaceUsers<
  T extends { sales_person_id?: string | null; created_at?: string | null },
>(
  leads: T[],
  salesPeople: SurfaceSalesPerson[],
  selectedAgency?: string | null,
): LeadTableGroup<T>[] {
  const nameById = new Map(salesPeople.map((person) => [person.id, person.full_name]));
  const surfacePeople = salesPeople.filter((person) =>
    isSalesPersonOnSurface(person, selectedAgency),
  );
  const buckets = new Map<string, T[]>();
  for (const person of surfacePeople) {
    buckets.set(person.id, []);
  }

  const extraIds: string[] = [];
  const unassigned: T[] = [];

  for (const lead of leads) {
    const ownerId = lead.sales_person_id;
    if (!ownerId) {
      unassigned.push(lead);
      continue;
    }
    const existing = buckets.get(ownerId);
    if (existing) {
      existing.push(lead);
      continue;
    }
    buckets.set(ownerId, [lead]);
    extraIds.push(ownerId);
  }

  const groups: LeadTableGroup<T>[] = surfacePeople.map((person) => ({
    id: person.id,
    label: person.full_name,
    leads: sortLeadsByDate(buckets.get(person.id) || []),
  }));

  for (const ownerId of extraIds) {
    groups.push({
      id: ownerId,
      label: nameById.get(ownerId) || "איש מכירות אחר",
      leads: sortLeadsByDate(buckets.get(ownerId) || []),
    });
  }

  if (unassigned.length > 0) {
    groups.push({
      id: UNASSIGNED_LEAD_GROUP_ID,
      label: "ללא שיוך",
      leads: sortLeadsByDate(unassigned),
    });
  }

  return groups;
}
