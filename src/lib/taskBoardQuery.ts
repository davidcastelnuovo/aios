import { startOfDay } from "date-fns";

/**
 * PostgREST `.or()` filter for the tasks board.
 *
 * Always includes: unscheduled, overdue, dated-without-time (backlog), and tasks
 * whose due_date falls in the active view range (timed or untimed).
 */
export function buildTaskDueDateOrFilter(input: {
  rangeStart: string;
  rangeEnd: string;
  today: string;
  customStart?: string;
  customEnd?: string;
}): string {
  const { rangeStart, rangeEnd, today, customStart, customEnd } = input;
  const datedUntimed = "and(due_time.is.null,due_date.not.is.null)";
  const overdueByTarget = `and(target_date.lt.${today},status.neq.done)`;
  const overdueByDue = `and(due_date.lt.${today},status.neq.done,target_date.is.null)`;

  if (customStart && customEnd) {
    return (
      `and(due_date.gte.${customStart},due_date.lte.${customEnd}),` +
      overdueByTarget + "," +
      overdueByDue + "," +
      "due_date.is.null," +
      datedUntimed
    );
  }

  return (
    `and(due_date.gte.${rangeStart},due_date.lte.${rangeEnd}),` +
    overdueByTarget + "," +
    overdueByDue + "," +
    "due_date.is.null," +
    datedUntimed
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
