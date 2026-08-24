export type TaskDeadlineFields = {
  target_date?: string | null;
  due_date?: string | null;
};

/** Effective deadline for overdue / display: explicit target, else legacy due_date. */
export function getTaskDeadlineDate(task: TaskDeadlineFields): string | null {
  return task.target_date ?? task.due_date ?? null;
}

export function isTaskOverdue(
  task: TaskDeadlineFields & { status: string },
  today: Date,
): boolean {
  if (task.status === "done") return false;
  const deadline = getTaskDeadlineDate(task);
  if (!deadline) return false;
  const day = new Date(deadline);
  day.setHours(0, 0, 0, 0);
  const todayStart = new Date(today);
  todayStart.setHours(0, 0, 0, 0);
  return day < todayStart;
}
