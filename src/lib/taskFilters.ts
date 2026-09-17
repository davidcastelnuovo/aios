import { startOfDay, startOfMonth, startOfWeek, subMonths, subYears } from "date-fns";

export type OpenClosedFilter = "all" | "open" | "done";
export type TaskPeriodFilter = "all" | "week" | "month" | "quarter" | "year";
export type TaskRelatedKind = "all" | "none" | "client" | "lead";

export const TASK_PERIOD_OPTIONS: { value: TaskPeriodFilter; label: string }[] = [
  { value: "all", label: "כל התקופות" },
  { value: "week", label: "השבוע" },
  { value: "month", label: "החודש" },
  { value: "quarter", label: "3 חודשים האחרונים" },
  { value: "year", label: "שנה האחרונה" },
];

export interface TaskFilterState {
  campaignerId: string;
  taskType: string;
  association: string;
  period: TaskPeriodFilter;
  relatedKind: TaskRelatedKind;
  relatedId: string;
  relatedLabel: string;
  openClosed: OpenClosedFilter;
}

/**
 * The board opens on the signed-in user's queue: tasks assigned to them and
 * tasks they assigned to someone else.
 */
export const defaultTaskFilters: TaskFilterState = {
  campaignerId: "mine_assigned",
  taskType: "all",
  association: "all",
  period: "all",
  relatedKind: "all",
  relatedId: "",
  relatedLabel: "",
  openClosed: "open",
};

export function isMineQueueFilter(campaignerFilter: string): boolean {
  return campaignerFilter === "mine" || campaignerFilter === "mine_assigned";
}

/** Activity window: open tasks by created_at, done tasks by updated_at. */
export function resolveTaskPeriodStart(period: TaskPeriodFilter, now = new Date()): Date | undefined {
  const today = startOfDay(now);
  if (period === "all") return undefined;
  if (period === "week") return startOfWeek(today, { weekStartsOn: 0 });
  if (period === "month") return startOfMonth(today);
  if (period === "quarter") return subMonths(today, 3);
  return subYears(today, 1);
}

export function taskMatchesActivityPeriod<
  T extends { status?: string | null; created_at?: string | null; updated_at?: string | null },
>(task: T, since?: Date): boolean {
  if (!since) return true;
  const stamp = task.status === "done" ? task.updated_at || task.created_at : task.created_at;
  if (!stamp) return false;
  const parsed = new Date(stamp);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed >= since;
}

export function filterTasksByRelatedEntity<
  T extends { client_id?: string | null; lead_id?: string | null },
>(tasks: T[], relatedKind: TaskRelatedKind, relatedId?: string): T[] {
  if (relatedKind === "all") return tasks;
  if (relatedKind === "none") {
    return tasks.filter((task) => !task.client_id && !task.lead_id);
  }
  if (!relatedId) return tasks;
  if (relatedKind === "lead") return tasks.filter((task) => task.lead_id === relatedId);
  return tasks.filter((task) => task.client_id === relatedId);
}

export function tasksFilterPresetKey(userId: string): string {
  return `aios-tasks-filter-preset:${userId}`;
}

type StoredTasksFilterPreset = {
  campaignerId?: string;
  taskType?: string;
  association?: string;
  period?: string;
  relatedKind?: string;
  relatedId?: string;
  relatedLabel?: string;
  openClosed?: string;
  clientId?: string;
};

function parsePeriod(value?: string): TaskPeriodFilter {
  if (value === "week" || value === "month" || value === "quarter" || value === "year" || value === "all") {
    return value;
  }
  return defaultTaskFilters.period;
}

function parseRelated(stored: StoredTasksFilterPreset | null | undefined): {
  relatedKind: TaskRelatedKind;
  relatedId: string;
  relatedLabel: string;
} {
  if (stored?.relatedKind === "client" || stored?.relatedKind === "lead" || stored?.relatedKind === "none") {
    return {
      relatedKind: stored.relatedKind,
      relatedId: stored.relatedId || "",
      relatedLabel: stored.relatedLabel || "",
    };
  }
  if (stored?.clientId === "none") {
    return { relatedKind: "none", relatedId: "", relatedLabel: "" };
  }
  if (stored?.clientId && stored.clientId !== "all") {
    return { relatedKind: "client", relatedId: stored.clientId, relatedLabel: "" };
  }
  return { relatedKind: "all", relatedId: "", relatedLabel: "" };
}

export function serializeTasksFilterPreset(filters: TaskFilterState): StoredTasksFilterPreset {
  return {
    campaignerId: filters.campaignerId,
    taskType: filters.taskType,
    association: filters.association,
    period: filters.period,
    relatedKind: filters.relatedKind,
    relatedId: filters.relatedId,
    relatedLabel: filters.relatedLabel,
    openClosed: filters.openClosed,
  };
}

export function parseTasksFilterPreset(stored: StoredTasksFilterPreset | null | undefined): TaskFilterState {
  const openClosed =
    stored?.openClosed === "all" || stored?.openClosed === "done" || stored?.openClosed === "open"
      ? stored.openClosed
      : defaultTaskFilters.openClosed;
  const related = parseRelated(stored);
  return {
    campaignerId: stored?.campaignerId || defaultTaskFilters.campaignerId,
    taskType: stored?.taskType || defaultTaskFilters.taskType,
    association: stored?.association || defaultTaskFilters.association,
    period: parsePeriod(stored?.period),
    ...related,
    openClosed,
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
