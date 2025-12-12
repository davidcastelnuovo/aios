import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "./useCurrentTenant";
import { toast } from "sonner";

export interface LeadPipelineStage {
  id: string;
  tenant_id: string;
  stage_key: string;
  label: string;
  color: string;
  sort_order: number;
  is_active: boolean;
}

export function useLeadPipelineStages() {
  const { tenantId } = useCurrentTenant();

  const { data: stages = [], isLoading, refetch } = useQuery({
    queryKey: ["lead-pipeline-stages", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      
      const { data, error } = await supabase
        .from("lead_pipeline_stages")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("sort_order");
      
      if (error) throw error;
      return data as LeadPipelineStage[];
    },
    enabled: !!tenantId,
  });

  const activeStages = stages.filter(s => s.is_active);

  return { stages, activeStages, isLoading, refetch };
}

export function useLeadPipelineStageMutations() {
  const queryClient = useQueryClient();
  const { tenantId } = useCurrentTenant();

  const updateStage = useMutation({
    mutationFn: async ({ id, label, color, sort_order, is_active }: Partial<LeadPipelineStage> & { id: string }) => {
      const { error } = await supabase
        .from("lead_pipeline_stages")
        .update({ label, color, sort_order, is_active, updated_at: new Date().toISOString() })
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-pipeline-stages"] });
    },
    onError: (error: Error) => {
      toast.error("שגיאה בעדכון שלב: " + error.message);
    },
  });

  const createStage = useMutation({
    mutationFn: async ({ label, color }: { label: string; color: string }) => {
      if (!tenantId) throw new Error("No tenant");

      const { data: existing } = await supabase
        .from("lead_pipeline_stages")
        .select("sort_order")
        .eq("tenant_id", tenantId)
        .order("sort_order", { ascending: false })
        .limit(1);

      const maxOrder = existing?.[0]?.sort_order ?? 0;
      const stage_key = `custom_${Date.now()}`;

      const { error } = await supabase
        .from("lead_pipeline_stages")
        .insert({
          tenant_id: tenantId,
          stage_key,
          label,
          color,
          sort_order: maxOrder + 1,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-pipeline-stages"] });
      toast.success("שלב נוסף בהצלחה");
    },
    onError: (error: Error) => {
      toast.error("שגיאה בהוספת שלב: " + error.message);
    },
  });

  const deleteStage = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("lead_pipeline_stages")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-pipeline-stages"] });
      toast.success("שלב נמחק");
    },
    onError: (error: Error) => {
      toast.error("שגיאה במחיקת שלב: " + error.message);
    },
  });

  const updateSortOrders = useMutation({
    mutationFn: async (updates: { id: string; sort_order: number }[]) => {
      for (const update of updates) {
        const { error } = await supabase
          .from("lead_pipeline_stages")
          .update({ sort_order: update.sort_order })
          .eq("id", update.id);
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-pipeline-stages"] });
    },
  });

  return { updateStage, createStage, deleteStage, updateSortOrders };
}
