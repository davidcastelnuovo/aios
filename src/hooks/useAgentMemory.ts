import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface MemoryItem {
  id: string;
  category: string;
  subcategory: string | null;
  path: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  title: string;
  summary: string | null;
  importance: number;
  ref_date?: string | null;
  metadata?: any;
  created_at: string;
}

export interface MemoryTreeNode {
  category: string;
  count: number;
  subcategories: { name: string; count: number }[];
}

// ----- agent_memory (non-Carmen) -----

export function useAgentMemory(agentId: string | null, category?: string, subcategory?: string | null) {
  return useQuery({
    queryKey: ["agent-memory", agentId, category ?? "all", subcategory ?? "all"],
    enabled: !!agentId,
    queryFn: async (): Promise<MemoryItem[]> => {
      let q = supabase
        .from("agent_memory" as any)
        .select("id, category, subcategory, path, entity_type, entity_id, title, summary, importance, ref_date, metadata, created_at")
        .eq("agent_id", agentId!)
        .order("created_at", { ascending: false })
        .limit(500);
      if (category) q = q.eq("category", category);
      if (subcategory === null) q = q.is("subcategory", null);
      else if (subcategory) q = q.eq("subcategory", subcategory);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as any;
    },
  });
}

export function useAgentMemoryTree(agentId: string | null) {
  return useQuery({
    queryKey: ["agent-memory-tree", agentId],
    enabled: !!agentId,
    queryFn: async (): Promise<MemoryTreeNode[]> => {
      const { data, error } = await supabase
        .from("agent_memory" as any)
        .select("category, subcategory")
        .eq("agent_id", agentId!)
        .limit(5000);
      if (error) throw error;
      return buildTree((data ?? []) as any);
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
      qc.invalidateQueries({ queryKey: ["agent-memory-tree", agentId] });
      toast.success("נמחק");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

// ----- Carmen memory (carmen_memory_pointers + carmen_memory_episodes) -----

export function useCarmenMemoryTree() {
  return useQuery({
    queryKey: ["carmen-memory-tree"],
    queryFn: async () => {
      const [pointers, episodes] = await Promise.all([
        supabase.from("carmen_memory_pointers" as any).select("category, subcategory").limit(10000),
        supabase.from("carmen_memory_episodes" as any).select("id", { count: "exact", head: true }),
      ]);
      if (pointers.error) throw pointers.error;
      const tree = buildTree((pointers.data ?? []) as any);
      return { tree, episodesCount: episodes.count ?? 0 };
    },
  });
}

export function useCarmenMemoryPointers(category?: string, subcategory?: string | null) {
  return useQuery({
    queryKey: ["carmen-memory-pointers", category ?? "all", subcategory ?? "all"],
    enabled: category !== "episodes",
    queryFn: async (): Promise<MemoryItem[]> => {
      let q = supabase
        .from("carmen_memory_pointers" as any)
        .select("id, category, subcategory, path, entity_type, entity_id, title, summary, importance, ref_date, metadata, created_at")
        .order("ref_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(500);
      if (category) q = q.eq("category", category);
      if (subcategory === null) q = q.is("subcategory", null);
      else if (subcategory) q = q.eq("subcategory", subcategory);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as any;
    },
  });
}

export function useCarmenMemoryEpisodes(enabled = false) {
  return useQuery({
    queryKey: ["carmen-memory-episodes"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("carmen_memory_episodes" as any)
        .select("id, topic, topic_tags, summary, source_table, participants, importance, ref_date, access_count, created_at")
        .order("ref_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

// ----- shared -----

function buildTree(rows: { category: string | null; subcategory: string | null }[]): MemoryTreeNode[] {
  const byCat = new Map<string, Map<string, number>>();
  for (const r of rows) {
    const cat = r.category || "other";
    if (!byCat.has(cat)) byCat.set(cat, new Map());
    const subMap = byCat.get(cat)!;
    const subKey = r.subcategory || "__root__";
    subMap.set(subKey, (subMap.get(subKey) ?? 0) + 1);
  }
  return Array.from(byCat.entries())
    .map(([category, subMap]) => {
      const total = Array.from(subMap.values()).reduce((a, b) => a + b, 0);
      const subcategories = Array.from(subMap.entries())
        .filter(([k]) => k !== "__root__")
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => (a.name < b.name ? 1 : -1)); // desc (months/newest first)
      return { category, count: total, subcategories };
    })
    .sort((a, b) => b.count - a.count);
}
