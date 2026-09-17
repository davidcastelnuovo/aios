export type OpenClosedFilter = "all" | "open" | "done";

export interface TaskFilterState {
  campaignerId: string;
  taskType: string;
  association: string;
  startDate: Date | undefined;
  endDate: Date | undefined;
  openClosed: OpenClosedFilter;
  clientId: string;
}

/**
 * The board opens on the signed-in user's queue: tasks assigned to them and
 * tasks they assigned to someone else.
 */
export const defaultTaskFilters: TaskFilterState = {
  campaignerId: "mine_assigned",
  taskType: "all",
  association: "all",
  startDate: undefined,
  endDate: undefined,
  openClosed: "open",
  clientId: "all",
};

export function isMineQueueFilter(campaignerFilter: string): boolean {
  return campaignerFilter === "mine" || campaignerFilter === "mine_assigned";
}

export function tasksFilterPresetKey(userId: string): string {
  return `aios-tasks-filter-preset:${userId}`;
}

type StoredTasksFilterPreset = {
  campaignerId?: string;
  taskType?: string;
  association?: string;
  startDate?: string | null;
  endDate?: string | null;
  openClosed?: string;
  clientId?: string;
};

function toDayString(value?: Date): string | null {
  if (!value) return null;
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDayString(value?: string | null): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export function serializeTasksFilterPreset(filters: TaskFilterState): StoredTasksFilterPreset {
  return {
    campaignerId: filters.campaignerId,
    taskType: filters.taskType,
    association: filters.association,
    startDate: toDayString(filters.startDate),
    endDate: toDayString(filters.endDate),
    openClosed: filters.openClosed,
    clientId: filters.clientId,
  };
}

export function parseTasksFilterPreset(stored: StoredTasksFilterPreset | null | undefined): TaskFilterState {
  const openClosed =
    stored?.openClosed === "all" || stored?.openClosed === "done" || stored?.openClosed === "open"
      ? stored.openClosed
      : defaultTaskFilters.openClosed;
  return {
    campaignerId: stored?.campaignerId || defaultTaskFilters.campaignerId,
    taskType: stored?.taskType || defaultTaskFilters.taskType,
    association: stored?.association || defaultTaskFilters.association,
    startDate: parseDayString(stored?.startDate),
    endDate: parseDayString(stored?.endDate),
    openClosed,
    clientId: stored?.clientId || defaultTaskFilters.clientId,
  };
}

export function hasTasksFilterPreset(userId?: string | null): boolean {
  if (!userId) return false;
  try {
    return Boolean(localStorage.getItem(tasksFilterPresetKey(userId)));
  } catch {
    return false;
  }
}

export function readTasksFilterPreset(userId?: string | null): TaskFilterState {
  if (!userId) return { ...defaultTaskFilters };
  try {
    const raw = localStorage.getItem(tasksFilterPresetKey(userId));
    if (!raw) return { ...defaultTaskFilters };
    return parseTasksFilterPreset(JSON.parse(raw) as StoredTasksFilterPreset);
  } catch {
    return { ...defaultTaskFilters };
  }
}

export function writeTasksFilterPreset(userId: string, filters: TaskFilterState): void {
  localStorage.setItem(tasksFilterPresetKey(userId), JSON.stringify(serializeTasksFilterPreset(filters)));
}

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

export type MineTaskIdentity = MineTaskAssignee & {
  campaignerIds: string[];
  userId: string;
};

type CampaignerBoardTask = {
  campaigner_id?: string | null;
  sales_person_id?: string | null;
  created_by?: string | null;
};

/** Client-side guard for the board campaigner toolbar / dialog filter. */
export function matchesMineQueueTask(
  task: CampaignerBoardTask,
  mine: MineTaskIdentity,
  mode: "mine" | "mine_assigned",
): boolean {
  const campaignerIds = new Set(mine.campaignerIds);
  if (task.campaigner_id && campaignerIds.has(task.campaigner_id)) return true;
  if (mine.kind === "assigned" && mine.salesPersonId && task.sales_person_id === mine.salesPersonId) {
    return true;
  }
  if (mode === "mine_assigned" && task.created_by === mine.userId) return true;
  if (mine.kind === "created_by" && task.created_by === mine.userId) return true;
  return false;
}

export function filterTasksByCampaignerBoardFilter<T extends CampaignerBoardTask>(
  tasks: T[],
  campaignerFilter: string,
  mine?: MineTaskIdentity | null,
): T[] {
  if (campaignerFilter === "all") return tasks;
  if (campaignerFilter === "none") {
    return tasks.filter((task) => task.campaigner_id == null);
  }
  if (isMineQueueFilter(campaignerFilter)) {
    if (!mine) return [];
    const mode = campaignerFilter === "mine_assigned" ? "mine_assigned" : "mine";
    return tasks.filter((task) => matchesMineQueueTask(task, mine, mode));
  }
  return tasks.filter((task) => task.campaigner_id === campaignerFilter);
}

/** View-as preview: only tasks owned by or assigned to the selected user. */
export function filterTasksForBoardUserPreview<T extends CampaignerBoardTask>(
  tasks: T[],
  boardUserId: string,
  mine?: MineTaskIdentity | null,
): T[] {
  if (!boardUserId || !mine) return [];
  const campaignerIds = new Set(mine.campaignerIds);
  return tasks.filter((task) => {
    if (task.created_by === boardUserId) return true;
    if (task.campaigner_id && campaignerIds.has(task.campaigner_id)) return true;
    if (mine.kind === "assigned" && mine.salesPersonId && task.sales_person_id === mine.salesPersonId) {
      return true;
    }
    return false;
  });
}

/** PostgREST `.or()` filter for "שלי בלבד" assignment rows. */
export function buildMineAssignmentOrFilter(identity: MineTaskIdentity): string | null {
  const parts: string[] = [];
  for (const id of identity.campaignerIds) {
    parts.push(`campaigner_id.eq.${id}`);
  }
  if (identity.kind === "assigned" && identity.salesPersonId) {
    parts.push(`sales_person_id.eq.${identity.salesPersonId}`);
  }
  if (parts.length === 0) return null;
  return parts.join(",");
}

/** PostgREST `.or()` for mine / mine+assigned-by-me queues. */
export function buildMineQueueOrFilter(
  identity: MineTaskIdentity,
  mode: "mine" | "mine_assigned",
): string | null {
  const parts: string[] = [];
  const assignment = buildMineAssignmentOrFilter(identity);
  if (assignment) parts.push(assignment);
  if (mode === "mine_assigned" || identity.kind === "created_by") {
    parts.push(`created_by.eq.${identity.userId}`);
  }
  if (parts.length === 0) return null;
  return parts.join(",");
}
