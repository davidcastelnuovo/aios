/** Unique assignee ids for a task (primary + collaborators, deduped). */
export function collectTaskAssigneeIds(
  primaryAssigneeId: string | null | undefined,
  collaboratorIds: string[] | null | undefined,
): string[] {
  const ids = [
    ...(primaryAssigneeId ? [primaryAssigneeId] : []),
    ...(collaboratorIds || []).filter(Boolean),
  ];
  return Array.from(new Set(ids));
}

/** Recurring tasks with multiple people become one solo recurring task per assignee. */
export function shouldFanOutRecurringTasks(
  recurrenceFrequency: string | null | undefined,
  assigneeIds: string[],
): boolean {
  return !!recurrenceFrequency && assigneeIds.length > 1;
}
