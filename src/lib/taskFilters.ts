export interface TaskFilterState {
  campaignerId: string;
  taskType: string;
  association: string;
  startDate: Date | undefined;
  endDate: Date | undefined;
}

/**
 * The board opens on the signed-in user's own queue, whatever their role.
 * Seeing the whole team is an explicit choice via the campaigner filter.
 */
export const defaultTaskFilters: TaskFilterState = {
  campaignerId: "mine",
  taskType: "all",
  association: "all",
  startDate: undefined,
  endDate: undefined,
};
