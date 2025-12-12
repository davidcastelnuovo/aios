import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "./useCurrentTenant";
import { toast } from "sonner";

export interface LeadStatus {
  id: string;
  tenant_id: string;
  status_key: string;
  label: string;
  color: string;
  sort_order: number;
  is_active: boolean;
}

export function useLeadStatuses() {
  const { tenantId } = useCurrentTenant();

  const { data: statuses = [], isLoading, refetch } = useQuery({
    queryKey: ["lead-statuses", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      
      const { data, error } = await supabase
        .from("lead_statuses")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("sort_order");
      
      if (error) throw error;
      return data as LeadStatus[];
    },
    enabled: !!tenantId,
  });

  const activeStatuses = statuses.filter(s => s.is_active);

  return { statuses, activeStatuses, isLoading, refetch };
}

export function useLeadStatusMutations() {
  const queryClient = useQueryClient();
  const { tenantId } = useCurrentTenant();

  const updateStatus = useMutation({
    mutationFn: async ({ id, label, color, sort_order, is_active }: Partial<LeadStatus> & { id: string }) => {
      const { error } = await supabase
        .from("lead_statuses")
        .update({ label, color, sort_order, is_active, updated_at: new Date().toISOString() })
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-statuses"] });
    },
    onError: (error: Error) => {
      toast.error("שגיאה בעדכון סטטוס: " + error.message);
    },
  });

  const createStatus = useMutation({
    mutationFn: async ({ label, color }: { label: string; color: string }) => {
      if (!tenantId) throw new Error("No tenant");

      // Get max sort_order
      const { data: existing } = await supabase
        .from("lead_statuses")
        .select("sort_order")
        .eq("tenant_id", tenantId)
        .order("sort_order", { ascending: false })
        .limit(1);

      const maxOrder = existing?.[0]?.sort_order ?? 0;
      const status_key = `custom_${Date.now()}`;

      const { error } = await supabase
        .from("lead_statuses")
        .insert({
          tenant_id: tenantId,
          status_key,
          label,
          color,
          sort_order: maxOrder + 1,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-statuses"] });
      toast.success("סטטוס נוסף בהצלחה");
    },
    onError: (error: Error) => {
      toast.error("שגיאה בהוספת סטטוס: " + error.message);
    },
  });

  const deleteStatus = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("lead_statuses")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-statuses"] });
      toast.success("סטטוס נמחק");
    },
    onError: (error: Error) => {
      toast.error("שגיאה במחיקת סטטוס: " + error.message);
    },
  });

  const updateSortOrders = useMutation({
    mutationFn: async (updates: { id: string; sort_order: number }[]) => {
      for (const update of updates) {
        const { error } = await supabase
          .from("lead_statuses")
          .update({ sort_order: update.sort_order })
          .eq("id", update.id);
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-statuses"] });
    },
  });

  return { updateStatus, createStatus, deleteStatus, updateSortOrders };
}
