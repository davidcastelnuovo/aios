import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";

export type GraphifyCommunity = {
  community: number | null;
  name: string;
  nodes: number;
  file_types: Record<string, number> | null;
};

export type GraphifyOverview = {
  active: boolean;
  version?: string;
  commit_sha?: string;
  node_count?: number;
  edge_count?: number;
  activated_at?: string;
  communities?: GraphifyCommunity[];
  relations?: Record<string, number>;
};

export type GraphifyNode = {
  id: string;
  label: string;
  file_type: string | null;
  source_file: string | null;
  source_location: string | null;
  degree: number;
};

export type GraphifyEdge = {
  source: string;
  target: string;
  relation: string;
  weight: number | null;
};

export type GraphifySearchHit = {
  node_id: string;
  label: string;
  file_type: string | null;
  source_file: string | null;
  source_location: string | null;
  community_name: string | null;
  distance: number;
  connections: { relation: string; node_id: string }[];
};

export function useGraphifyOverview() {
  const { tenantId } = useCurrentTenant();
  return useQuery({
    queryKey: ["graphify-overview", tenantId],
    queryFn: async (): Promise<GraphifyOverview> => {
      const { data, error } = await supabase.rpc("graphify_overview" as any);
      if (error) throw error;
      return (data ?? { active: false }) as GraphifyOverview;
    },
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 10,
    retry: false,
  });
}

export function useGraphifyCommunity(community: number | null) {
  const { tenantId } = useCurrentTenant();
  return useQuery({
    queryKey: ["graphify-community", community, tenantId],
    queryFn: async (): Promise<{ nodes: GraphifyNode[]; edges: GraphifyEdge[] }> => {
      const { data, error } = await supabase.rpc("graphify_community_subgraph" as any, {
        p_community: community,
        p_limit: 400,
      });
      if (error) throw error;
      const parsed = (data ?? {}) as any;
      return {
        nodes: Array.isArray(parsed.nodes) ? parsed.nodes : [],
        edges: Array.isArray(parsed.edges) ? parsed.edges : [],
      };
    },
    enabled: community !== null && !!tenantId,
    staleTime: 1000 * 60 * 10,
    retry: false,
  });
}

export function useGraphifySearch(query: string) {
  const { tenantId } = useCurrentTenant();
  const trimmed = query.trim();
  return useQuery({
    queryKey: ["graphify-search", trimmed, tenantId],
    queryFn: async (): Promise<GraphifySearchHit[]> => {
      const { data, error } = await supabase.rpc("graphify_search" as any, {
        p_query: trimmed,
        p_depth: 1,
        p_limit: 40,
      });
      if (error) throw error;
      return Array.isArray(data) ? (data as GraphifySearchHit[]) : [];
    },
    enabled: trimmed.length >= 2 && !!tenantId,
    staleTime: 1000 * 60 * 5,
    retry: false,
  });
}
