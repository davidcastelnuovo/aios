import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CursorTaskSession = {
  id: string;
  tenant_id: string;
  cursor_agent_id: string;
  session_url: string | null;
  display_name: string;
  human_task_id: string | null;
  task_title: string | null;
  source_tool: string;
  app_env: string | null;
  status: "running" | "completed" | "failed" | "busy";
  created_at: string;
  updated_at: string;
  last_seen_at: string;
};

export async function fetchActiveCursorSessions(tenantId: string): Promise<CursorTaskSession[]> {
  const { data, error } = await supabase
    .from("cursor_task_sessions")
    .select("*")
    .eq("tenant_id", tenantId)
    .in("status", ["running", "busy"])
    .order("updated_at", { ascending: false })
    .limit(12);
  if (error) throw error;
  return (data || []) as CursorTaskSession[];
}

export function useActiveCursorSessions(tenantId: string | null) {
  return useQuery({
    queryKey: ["cursor-task-sessions", tenantId],
    queryFn: () => fetchActiveCursorSessions(tenantId!),
    enabled: Boolean(tenantId),
    refetchInterval: 30_000,
  });
}
