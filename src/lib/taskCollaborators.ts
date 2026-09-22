/** Tenant stamped on task_collaborators rows — must match the parent task. */
export function resolveTaskCollaboratorTenantId(
  taskTenantId: string | null | undefined,
  activeTenantId: string | null | undefined,
): string | null {
  return taskTenantId ?? activeTenantId ?? null;
}

export function formatTaskCollaboratorInsertError(message: string): string {
  const lower = message.toLowerCase();
  if (
    lower.includes("duplicate") ||
    lower.includes("unique") ||
    lower.includes("task_collaborators_task_id_campaigner_id_key")
  ) {
    return "איש הצוות כבר משויך למשימה";
  }
  if (lower.includes("row-level security") || lower.includes("42501")) {
    return "אין הרשאה להוסיף איש צוות למשימה הזו";
  }
  return message;
}
