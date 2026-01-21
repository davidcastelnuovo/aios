import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCurrentTenant } from "./useCurrentTenant";

interface CreateCampaignerParams {
  userId: string;
  fullName: string;
  email?: string;
  phone?: string;
  agencyIds: string[];
  roles?: string[];
  notes?: string;
}

interface CreateSalesPersonParams {
  userId: string;
  fullName: string;
  email?: string;
  phone?: string;
  agencyId: string;
  notes?: string;
}

/**
 * Hook לייצור אוטומטי של campaigner או sales_person מתוך משתמש קיים
 * מקשר אוטומטית את המשתמש לרשומה החדשה
 */
export function useAutoCreateTeamMember() {
  const queryClient = useQueryClient();
  const { tenantId } = useCurrentTenant();

  /**
   * יצירת קמפיינר חדש וקישורו למשתמש
   */
  const createCampaigner = useMutation({
    mutationFn: async (params: CreateCampaignerParams) => {
      if (!tenantId) throw new Error("לא נמצא tenant_id");

      // 1. יצירת הקמפיינר
      const { data: campaigner, error: campaignerError } = await supabase
        .from("campaigners")
        .insert({
          full_name: params.fullName,
          email: params.email || null,
          phone: params.phone || null,
          role: params.roles && params.roles.length > 0 ? params.roles : null,
          notes: params.notes || null,
          active: true,
          tenant_id: tenantId,
        })
        .select()
        .single();

      if (campaignerError) throw campaignerError;

      // 2. קישור לסוכנויות
      if (params.agencyIds && params.agencyIds.length > 0) {
        const agencyLinks = params.agencyIds.map(agencyId => ({
          campaigner_id: campaigner.id,
          agency_id: agencyId,
        }));

        const { error: linksError } = await supabase
          .from("campaigner_agencies")
          .insert(agencyLinks);

        if (linksError) throw linksError;
      }

      // 3. קישור הקמפיינר למשתמש
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ campaigner_id: campaigner.id })
        .eq("id", params.userId);

      if (profileError) throw profileError;

      return campaigner;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigners"] });
      queryClient.invalidateQueries({ queryKey: ["campaigner_agencies"] });
      queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
      queryClient.invalidateQueries({ queryKey: ["user-campaigner"] });
      toast.success("איש צוות נוצר ושויך למשתמש בהצלחה");
    },
    onError: (error: Error) => {
      toast.error("שגיאה ביצירת איש צוות: " + error.message);
    },
  });

  /**
   * יצירת איש מכירות חדש וקישורו למשתמש
   */
  const createSalesPerson = useMutation({
    mutationFn: async (params: CreateSalesPersonParams) => {
      if (!tenantId) throw new Error("לא נמצא tenant_id");

      // 1. יצירת איש המכירות
      const { data: salesPerson, error: salesPersonError } = await supabase
        .from("sales_people")
        .insert({
          full_name: params.fullName,
          email: params.email || null,
          phone: params.phone || null,
          agency_id: params.agencyId,
          notes: params.notes || null,
          active: true,
          tenant_id: tenantId,
        })
        .select()
        .single();

      if (salesPersonError) throw salesPersonError;

      // 2. קישור איש המכירות למשתמש
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ sales_person_id: salesPerson.id })
        .eq("id", params.userId);

      if (profileError) throw profileError;

      return salesPerson;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-people"] });
      queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
      queryClient.invalidateQueries({ queryKey: ["user-sales-person"] });
      toast.success("איש מכירות נוצר ושויך למשתמש בהצלחה");
    },
    onError: (error: Error) => {
      toast.error("שגיאה ביצירת איש מכירות: " + error.message);
    },
  });

  return {
    createCampaigner,
    createSalesPerson,
  };
}
