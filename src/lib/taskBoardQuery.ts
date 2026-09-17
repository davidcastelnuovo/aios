import { startOfDay } from "date-fns";
import { isTaskOverdue } from "./taskDeadline.ts";

/**
 * PostgREST `.or()` filter for the tasks board.
 *
 * Includes:
 * - tasks whose due_date falls in the active view range (timed or untimed, any status)
 * - overdue open tasks (due_date < today, status != done)
 * - unscheduled OPEN tasks (no due_date, not done)
 *
 * Does NOT pull historical completed tasks that have no due_date, and does NOT
 * pull every untimed dated row in the tenant — those two clauses were flooding
 * the board after the target_date 400-fix made the query succeed again.
 */
export function buildTaskDueDateOrFilter(input: {
  rangeStart: string;
  rangeEnd: string;
  today: string;
  customStart?: string;
  customEnd?: string;
}): string {
  const { rangeStart, rangeEnd, today, customStart, customEnd } = input;
  // Filter only on due_date. `tasks.target_date` is a later column; referencing it
  // in PostgREST before the migration is applied 400s the whole board query.
  const overdueOpen = `and(due_date.lt.${today},status.neq.done)`;
  const unscheduledOpen = "and(due_date.is.null,status.neq.done)";
  const start = customStart && customEnd ? customStart : rangeStart;
  const end = customStart && customEnd ? customEnd : rangeEnd;

  return (
    `and(due_date.gte.${start},due_date.lte.${end}),` +
    overdueOpen + "," +
    unscheduledOpen
  );
}

/**
 * PostgREST `.or()` filter for the tasks chat list.
 *
 * Includes every not-done task (any due date / unscheduled) plus recently
 * completed rows so the list is a work queue, not a calendar window.
 * Custom date filters still narrow by due_date when a start and/or end bound is set.
 */
export function buildChatTaskOrFilter(input: {
  today: string;
  doneSince: string;
  customStart?: string;
  customEnd?: string;
}): string {
  const { doneSince, customStart, customEnd } = input;
  const notDone = "status.neq.done";
  const recentDone = `and(status.eq.done,updated_at.gte.${doneSince})`;
  const dueBounds: string[] = [];
  if (customStart) dueBounds.push(`due_date.gte.${customStart}`);
  if (customEnd) dueBounds.push(`due_date.lte.${customEnd}`);
  if (dueBounds.length > 0) {
    return `and(${dueBounds.join(",")}),and(due_date.is.null,status.neq.done)`;
  }
  return `${notDone},${recentDone}`;
}

export function filterTasksForChatSearch<
  T extends {
    title?: string | null;
    notes?: string | null;
    clients?: { name?: string | null } | null;
    campaigners?: { full_name?: string | null } | null;
    creator_name?: string | null;
  },
>(tasks: T[], search: string): T[] {
  const q = search.trim().toLowerCase();
  if (!q) return tasks;
  return tasks.filter((task) =>
    (task.title || "").toLowerCase().includes(q) ||
    (task.notes || "").toLowerCase().includes(q) ||
    (task.clients?.name || "").toLowerCase().includes(q) ||
    (task.campaigners?.full_name || "").toLowerCase().includes(q) ||
    (task.creator_name || "").toLowerCase().includes(q)
  );
}

export function sortTasksForChatList<
  T extends {
    id: string;
    status: string;
    priority: number;
    due_date: string | null;
    target_date?: string | null;
    created_at?: string;
  },
>(tasks: T[], today: Date): T[] {
  const rank = (task: T) => {
    if (task.status === "done") return 3;
    if (isTaskOverdue(task, today)) return 0;
    if (task.status === "in_progress") return 1;
    return 2;
  };
  return [...tasks].sort((a, b) => {
    const rankDiff = rank(a) - rank(b);
    if (rankDiff !== 0) return rankDiff;
    if (b.priority !== a.priority) return b.priority - a.priority;
    const aDeadline = a.target_date || a.due_date;
    const bDeadline = b.target_date || b.due_date;
    if (aDeadline && bDeadline && aDeadline !== bDeadline) {
      return aDeadline.localeCompare(bDeadline);
    }
    if (aDeadline && !bDeadline) return -1;
    if (!aDeadline && bDeadline) return 1;
    const aCreated = a.created_at || "";
    const bCreated = b.created_at || "";
    if (aCreated !== bCreated) return bCreated.localeCompare(aCreated);
    return b.id.localeCompare(a.id);
  });
}

/** Whether a task should render on the timed day-column grid (not backlog). */
export function taskAppearsOnTimeGrid(
  task: { due_date: string | null; due_time: string | null; status: string },
  dateRange: { start: Date; end: Date },
  today: Date = startOfDay(new Date()),
): boolean {
  if (!task.due_date || !task.due_time) return false;
  if (task.status === "done") return false;
  const dueDate = new Date(task.due_date);
  if (dueDate < today) return false;
  return dueDate >= dateRange.start && dueDate <= dateRange.end;
}
