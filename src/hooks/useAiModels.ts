import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AiModel {
  id: string;
  alias?: string;
  label: string;
  family: "google" | "openai" | "anthropic";
  context_window?: number;
  capabilities?: string[];
  isLatest?: boolean;
  recommended?: boolean;
  cheap?: boolean;
}

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
