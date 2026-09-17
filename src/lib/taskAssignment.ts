export type TaskAssignmentSource = {
  campaigners?: { full_name?: string | null } | null;
  sales_people?: { full_name?: string | null } | null;
  clients?: { name?: string | null } | null;
  leads?: { company_name?: string | null } | null;
  creator_name?: string | null;
};

export type TaskAssignmentLabels = {
  assignedTo: string | null;
  client: string | null;
  lead: string | null;
  givenBy: string | null;
};

/** Who the task was given to, which client, and who created it. */
export function describeTaskAssignment(
  task: TaskAssignmentSource,
  fallbackClientName?: string | null,
): TaskAssignmentLabels {
  return {
    assignedTo: task.campaigners?.full_name?.trim() || task.sales_people?.full_name?.trim() || null,
    client: task.clients?.name?.trim() || fallbackClientName?.trim() || null,
    lead: task.leads?.company_name?.trim() || null,
    givenBy: task.creator_name?.trim() || null,
  };
}
