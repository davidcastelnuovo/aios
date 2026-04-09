import type { QueryClient } from "@tanstack/react-query";

const relatedQueryKeys: Record<string, string[]> = {
  tasks: ["calendar-events"],
  clients: ["dmm-clients", "dmm-clients-crm-fields", "dmm-performance-data"],
  communication_logs: ["communication-logs-latest"],
};

export function invalidateAIEntityQueries(queryClient: QueryClient, entity?: string) {
  if (!entity) return;

  queryClient.invalidateQueries({ queryKey: [entity] });

  for (const queryKey of relatedQueryKeys[entity] ?? []) {
    queryClient.invalidateQueries({ queryKey: [queryKey] });
  }
}