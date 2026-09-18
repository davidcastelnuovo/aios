import { format, startOfDay } from "date-fns";
import { isTaskOverdue } from "./taskDeadline.ts";

type RecurringBoardTask = {
  recurrence_frequency?: string | null;
  due_date?: string | null;
  due_time?: string | null;
  status?: string;
};

export function isRecurringBoardTask(task: RecurringBoardTask): boolean {
  return Boolean(task.recurrence_frequency);
}

/** Non-recurring tasks pass through; recurring ones only when due today or overdue. */
export function shouldShowRecurringTaskNow(
  task: RecurringBoardTask,
  asOf: Date = startOfDay(new Date()),
): boolean {
  if (!isRecurringBoardTask(task)) return true;
  if (task.status === "done") return false;
  if (!task.due_date) return false;
  if (isTaskOverdue(task, asOf)) return true;
  return format(startOfDay(new Date(task.due_date)), "yyyy-MM-dd") === format(asOf, "yyyy-MM-dd");
}

/** Recurring tasks in the week backlog only on their due day (untimed/overdue), not all week. */
export function recurringTaskBelongsInBacklog(
  task: RecurringBoardTask,
  today: Date = startOfDay(new Date()),
): boolean {
  if (!isRecurringBoardTask(task)) return false;
  if (task.status === "done") return false;
  if (!task.due_date) return false;
  if (isTaskOverdue(task, today)) return true;
  if (format(startOfDay(new Date(task.due_date)), "yyyy-MM-dd") !== format(today, "yyyy-MM-dd")) {
    return false;
  }
  return !task.due_time;
}
