import { isTaskDateBefore, isTaskDateInRange, parseTaskDate } from "./taskDate.ts";

export type BoardVisibleTask = {
  due_date: string | null;
  due_time: string | null;
  status: string;
};

/**
 * PostgREST `or()` for the weekly board.
 *
 * The old filter kept only: current range, overdue, or null due_date.
 * Setting a future date from the task dialog (especially without a time)
 * dropped the row out of the query — the task "vanished".
 *
 * Also keep every open/in-progress untimed task, so a date-only assignment
 * stays in the backlog until the user opens that week.
 */
export function buildTasksBoardDateFilter(input: {
  rangeStart: string;
  rangeEnd: string;
  today: string;
}): string {
  const { rangeStart, rangeEnd, today } = input;
  return [
    `and(due_date.gte.${rangeStart},due_date.lte.${rangeEnd})`,
    `and(due_date.lt.${today},status.neq.done)`,
    `due_date.is.null`,
    `and(due_time.is.null,status.neq.done)`,
  ].join(",");
}

export function isIncompleteStatus(status: string): boolean {
  return status !== "done";
}

/**
 * Split fetched tasks into the backlog rail vs the calendar grid.
 * Date-only tasks that fall inside the visible range belong on that day
 * (all-day), not in the leftover pile — that was why Felix "added to the
 * calendar" and saw nothing.
 */
export function splitBoardTasks<T extends BoardVisibleTask>(
  tasks: T[],
  range: { start: Date; end: Date },
  today: Date,
): { backlog: T[]; calendar: T[] } {
  const backlog: T[] = [];
  const calendar: T[] = [];

  for (const task of tasks) {
    if (!isIncompleteStatus(task.status) && !task.due_date) {
      continue;
    }

    if (!task.due_date) {
      if (isIncompleteStatus(task.status)) backlog.push(task);
      continue;
    }

    const overdue = isTaskDateBefore(task.due_date, today) && isIncompleteStatus(task.status);
    if (overdue) {
      backlog.push(task);
      continue;
    }

    if (isTaskDateInRange(task.due_date, range.start, range.end)) {
      calendar.push(task);
      continue;
    }

    // Future date-only task outside this week: keep it visible in the rail.
    if (!task.due_time && isIncompleteStatus(task.status)) {
      backlog.push(task);
    }
  }

  return { backlog, calendar };
}

export function shouldJumpBoardToDueDate(
  dueDate: string | null | undefined,
  range: { start: Date; end: Date },
): Date | null {
  const parsed = parseTaskDate(dueDate);
  if (!parsed) return null;
  if (isTaskDateInRange(parsed, range.start, range.end)) return null;
  return parsed;
}

export function taskBoardRowFingerprint(task: {
  id: string;
  agency_id?: string | null;
  duration_minutes?: number | null;
  status?: string | null;
  campaigner_id?: string | null;
  client_id?: string | null;
  due_date?: string | null;
  due_time?: string | null;
}): string {
  return [
    task.id,
    task.agency_id ?? "",
    task.duration_minutes ?? "",
    task.status ?? "",
    task.campaigner_id ?? "",
    task.client_id ?? "",
    task.due_date ?? "",
    task.due_time ?? "",
  ].join("_");
}
