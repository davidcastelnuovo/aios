import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { pickExistingTeamMember } from "@/lib/teamMemberMatch";
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

      const { data: profileRow, error: profileReadError } = await supabase
        .from("profiles")
        .select("campaigner_id")
        .eq("id", params.userId)
        .maybeSingle();
      if (profileReadError) throw profileReadError;

      const { data: existingCampaigners, error: listError } = await supabase
        .from("campaigners")
        .select("id, full_name, email, active, created_at")
        .eq("tenant_id", tenantId);
      if (listError) throw listError;

      const assigned = (existingCampaigners || []).find(
        (row) => row.id === profileRow?.campaigner_id,
      );
      const existing = assigned
        ? assigned
        : pickExistingTeamMember(existingCampaigners || [], {
            email: params.email,
            fullName: params.fullName,
          });

      let campaigner = existing
        ? { id: existing.id, reused: true as const }
        : null;

      if (!campaigner) {
        const { data: created, error: campaignerError } = await supabase
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
          .select("id")
          .single();

        if (campaignerError) throw campaignerError;
        campaigner = { id: created.id, reused: false as const };
      } else if (!(existing?.email || "").trim() && params.email) {
        await supabase.from("campaigners").update({ email: params.email }).eq("id", existing.id);
      }

      // 2. קישור לסוכנויות
      if (params.agencyIds && params.agencyIds.length > 0) {
        const agencyLinks = params.agencyIds.map(agencyId => ({
          campaigner_id: campaigner.id,
          agency_id: agencyId,
        }));

        const { error: linksError } = await supabase
          .from("campaigner_agencies")
          .upsert(agencyLinks, { onConflict: "campaigner_id,agency_id", ignoreDuplicates: true });

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
    onSuccess: (campaigner) => {
      queryClient.invalidateQueries({ queryKey: ["campaigners", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["campaigner_agencies", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["users-with-roles", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["user-campaigner", tenantId] });
      toast.success(
        campaigner.reused
          ? "המשתמש שויך לאיש הצוות הקיים"
          : "איש צוות נוצר ושויך למשתמש בהצלחה",
      );
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

      const { data: profileRow, error: profileReadError } = await supabase
        .from("profiles")
        .select("sales_person_id")
        .eq("id", params.userId)
        .maybeSingle();
      if (profileReadError) throw profileReadError;

      const { data: existingSalesPeople, error: listError } = await supabase
        .from("sales_people")
        .select("id, full_name, email, active, created_at")
        .eq("tenant_id", tenantId);
      if (listError) throw listError;

      const assigned = (existingSalesPeople || []).find(
        (row) => row.id === profileRow?.sales_person_id,
      );
      const existing = assigned
        ? assigned
        : pickExistingTeamMember(existingSalesPeople || [], {
            email: params.email,
            fullName: params.fullName,
          });

      let salesPerson = existing
        ? { id: existing.id, reused: true as const }
        : null;

      if (!salesPerson) {
        const { data: created, error: salesPersonError } = await supabase
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
          .select("id")
          .single();

        if (salesPersonError) throw salesPersonError;
        salesPerson = { id: created.id, reused: false as const };
      } else if (!(existing?.email || "").trim() && params.email) {
        await supabase.from("sales_people").update({ email: params.email }).eq("id", existing.id);
      }

      // 2. קישור איש המכירות למשתמש
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ sales_person_id: salesPerson.id })
        .eq("id", params.userId);

      if (profileError) throw profileError;

      return salesPerson;
    },
    onSuccess: (salesPerson) => {
      queryClient.invalidateQueries({ queryKey: ["sales-people", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["users-with-roles", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["user-sales-person", tenantId] });
      toast.success(
        salesPerson.reused
          ? "המשתמש שויך לאיש המכירות הקיים"
          : "איש מכירות נוצר ושויך למשתמש בהצלחה",
      );
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
