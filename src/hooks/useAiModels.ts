import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";

export interface AiModel {
  id: string;
  alias?: string;
  label: string;
  family: "google" | "openai" | "anthropic" | "manus";
  context_window?: number;
  capabilities?: string[];
  isLatest?: boolean;
  recommended?: boolean;
  cheap?: boolean;
}

export type ConnectedProviders = {
  google: boolean;
  openai: boolean;
  anthropic: boolean;
  manus: boolean;
};

export function useAiModels() {
  return useQuery({
    queryKey: ["ai-models"],
    staleTime: 30 * 60 * 1000,
    queryFn: async (): Promise<AiModel[]> => {
      const { data, error } = await supabase.functions.invoke("list-ai-models");
      if (error) throw error;
      return (data?.models ?? []) as AiModel[];
    },
  });
}

/** Returns which LLM providers have a key configured for the current tenant */
export function useConnectedProviders() {
  const { tenantId } = useCurrentTenant();
  return useQuery({
    queryKey: ["llm-connected-providers", tenantId],
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<ConnectedProviders> => {
      if (!tenantId) return { google: false, openai: false, anthropic: false, manus: false };
      const { data } = await supabase
        .from("tenant_integrations")
        .select("settings")
        .eq("tenant_id", tenantId)
        .eq("integration_type", "llm")
        .eq("is_active", true)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const s = (data?.settings ?? {}) as Record<string, string>;
      // Check manus integration separately
      const { data: manusData } = await supabase
        .from("tenant_integrations")
        .select("settings")
        .eq("tenant_id", tenantId)
        .eq("integration_type", "manus")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      const ms = (manusData?.settings ?? {}) as Record<string, string>;
      return {
        google: typeof s.google_api_key === "string" && s.google_api_key.length > 0,
        openai: typeof s.openai_api_key === "string" && s.openai_api_key.length > 0,
        anthropic: typeof s.anthropic_api_key === "string" && s.anthropic_api_key.length > 0,
        manus: typeof ms.api_key === "string" && ms.api_key.length > 0,
      };
    },
  });
}

/** Returns only models whose provider has a key configured */
export function useConnectedAiModels() {
  const { data: allModels = [], isLoading: modelsLoading } = useAiModels();
  const { data: connected, isLoading: connLoading } = useConnectedProviders();

  const isLoading = modelsLoading || connLoading;

  const models = connected
    ? allModels.filter((m) => {
        if (m.family === "google") return connected.google;
        if (m.family === "openai") return connected.openai;
        if (m.family === "anthropic") return connected.anthropic;
        if (m.family === "manus") return connected.manus;
        return false;
      })
    : [];

  return { data: models, isLoading, connected };
}
