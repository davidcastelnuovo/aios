export interface TaskFilterState {
  campaignerId: string;
  taskType: string;
  association: string;
  startDate: Date | undefined;
  endDate: Date | undefined;
}

/**
 * The board opens on the signed-in user's own queue: tasks assigned to the
 * campaigner/sales-person record linked on their profile.
 */
export const defaultTaskFilters: TaskFilterState = {
  campaignerId: "mine",
  taskType: "all",
  association: "all",
  startDate: undefined,
  endDate: undefined,
};

/** Who "שלי בלבד" actually means: the staff row the user is linked to. */
export type MineTaskAssignee =
  | { kind: "assigned"; campaignerId?: string; salesPersonId?: string }
  | { kind: "created_by"; userId: string }
  | { kind: "none" };

export function resolveMineTaskAssignee(input: {
  campaignerId?: string | null;
  salesPersonId?: string | null;
  userId?: string | null;
}): MineTaskAssignee {
  const campaignerId = input.campaignerId || undefined;
  const salesPersonId = input.salesPersonId || undefined;
  if (campaignerId || salesPersonId) {
    return { kind: "assigned", campaignerId, salesPersonId };
  }
  if (input.userId) return { kind: "created_by", userId: input.userId };
  return { kind: "none" };
}
