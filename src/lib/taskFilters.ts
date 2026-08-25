export interface TaskFilterState {
  campaignerId: string;
  taskType: string;
  association: string;
  startDate: Date | undefined;
  endDate: Date | undefined;
}

/**
 * Campaigners land on their personal queue. Owners/admins (and anyone without
 * a campaigner/sales identity) land on the team board — "mine" for an owner
 * is usually empty because they create tasks assigned to other people, and
 * "mine" intentionally ignores created_by.
 */
export const defaultTaskFilters: TaskFilterState = {
  campaignerId: "mine",
  taskType: "all",
  association: "all",
  startDate: undefined,
  endDate: undefined,
};

export function resolveDefaultCampaignerFilter(input: {
  isOwner?: boolean;
  isSuperAdmin?: boolean;
  hasPersonalQueue?: boolean;
}): "mine" | "all" {
  if (input.isOwner || input.isSuperAdmin) return "all";
  if (input.hasPersonalQueue) return "mine";
  return "all";
}
