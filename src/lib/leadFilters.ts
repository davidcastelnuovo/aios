/**
 * Client-side lead filter application.
 *
 * Table view applies most of these server-side. Chat/kanban fetch via
 * get_leads_by_stages, which ignores pipeline-stage, "none" sales-person,
 * and "none" response-status. This helper is the shared catch-up so every
 * view mode sees the same filter results.
 */

export type LeadFilterSlice = {
  stageId: string;
  salesPersonIds: string[];
  responseStatus: string[];
  tagIds: string[];
};

export type FilterableLead = {
  id: string;
  status?: string | null;
  sales_person_id?: string | null;
  response_status?: string | null;
};

function matchesMultiNone<T>(
  selected: string[],
  value: T | null | undefined,
  isNone: (value: T | null | undefined) => boolean,
  matchesOther: (value: T, otherId: string) => boolean,
): boolean {
  if (selected.length === 0) return true;
  const includeNone = selected.includes("none");
  const others = selected.filter((id) => id !== "none");
  const noneMatch = includeNone && isNone(value);
  const otherMatch =
    value != null && others.some((id) => matchesOther(value as T, id));
  if (includeNone && others.length > 0) return noneMatch || otherMatch;
  if (includeNone) return noneMatch;
  return otherMatch;
}

export function applyLeadClientFilters<T extends FilterableLead>(
  leads: T[],
  filters: LeadFilterSlice,
  leadsTagsMap: Record<string, string[]> = {},
): T[] {
  let result = leads;

  if (filters.stageId && filters.stageId !== "all") {
    result = result.filter((lead) => lead.status === filters.stageId);
  }

  if (filters.salesPersonIds.length > 0) {
    result = result.filter((lead) =>
      matchesMultiNone(
        filters.salesPersonIds,
        lead.sales_person_id,
        (value) => value == null || value === "",
        (value, otherId) => value === otherId,
      ),
    );
  }

  if (filters.responseStatus.length > 0) {
    result = result.filter((lead) =>
      matchesMultiNone(
        filters.responseStatus,
        lead.response_status,
        (value) => value == null || value === "",
        (value, otherId) => value === otherId,
      ),
    );
  }

  if (filters.tagIds.length > 0) {
    result = result.filter((lead) => {
      const leadTags = leadsTagsMap[lead.id] || [];
      return matchesMultiNone(
        filters.tagIds,
        leadTags,
        (tags) => !tags || tags.length === 0,
        (tags, otherId) => tags.includes(otherId),
      );
    });
  }

  return result;
}

export function endOfDayIso(date: Date): string {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end.toISOString();
}
