import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface AgentMemoryItem {
  id: string;
  agent_id: string;
  category: string;
  title: string;
  summary: string | null;
  importance: number;
  created_at: string;
  metadata: any;
}

export function useAgentMemory(agentId: string | null, category?: string) {
  return useQuery({
    queryKey: ["agent-memory", agentId, category ?? "all"],
    enabled: !!agentId,
    queryFn: async (): Promise<AgentMemoryItem[]> => {
      let q = supabase
        .from("agent_memory" as any)
        .select("id, agent_id, category, title, summary, importance, created_at, metadata")
        .eq("agent_id", agentId!)
        .order("created_at", { ascending: false })
        .limit(200);
      if (category) q = q.eq("category", category);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as any;
    },
  });
}

export function useDeleteAgentMemory(agentId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("agent_memory" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agent-memory", agentId] });
      toast.success("נמחק");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

// Carmen's memory (read-only here) — uses carmen_memory_pointers
export function useCarmenMemoryPointers() {
  return useQuery({
    queryKey: ["carmen-memory-pointers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("carmen_memory_pointers" as any)
        .select("id, category, subcategory, path, title, summary, importance, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });
}
