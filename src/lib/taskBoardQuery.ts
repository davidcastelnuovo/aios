import { startOfDay } from "date-fns";

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
