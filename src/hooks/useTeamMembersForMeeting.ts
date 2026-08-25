import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type MeetingTeamMember = {
  id: string;
  full_name: string | null;
  email: string;
};

/**
 * System users who can be invited to a meeting in the current tenant:
 * tenant_users, user_roles, the signed-in user, and profiles linked to
 * agencies shared into this tenant.
 */
export function useTeamMembersForMeeting(
  tenantId?: string | null,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: ["team-members-for-meeting", tenantId],
    queryFn: async (): Promise<MeetingTeamMember[]> => {
      if (!tenantId) return [];

      const { data: sessionData } = await supabase.auth.getSession();
      const currentUserId = sessionData?.session?.user?.id;

      const [{ data: tenantUsers }, { data: roleRows }, { data: sharedAccess }] =
        await Promise.all([
          supabase.from("tenant_users").select("user_id").eq("tenant_id", tenantId),
          supabase.from("user_roles").select("user_id").eq("tenant_id", tenantId),
          supabase
            .from("agency_tenant_access")
            .select("agency_id")
            .eq("accessing_tenant_id", tenantId),
        ]);

      const ids = new Set<string>();
      (tenantUsers || []).forEach((row) => {
        if (row.user_id) ids.add(row.user_id);
      });
      (roleRows || []).forEach((row) => {
        if (row.user_id) ids.add(row.user_id);
      });
      if (currentUserId) ids.add(currentUserId);

      const agencyIds = (sharedAccess || [])
        .map((row) => row.agency_id)
        .filter(Boolean);
      if (agencyIds.length > 0) {
        const [{ data: campaignerLinks }, { data: salesLinks }] = await Promise.all([
          supabase
            .from("campaigner_agencies")
            .select("campaigner_id")
            .in("agency_id", agencyIds),
          supabase
            .from("sales_person_agencies")
            .select("sales_person_id")
            .in("agency_id", agencyIds),
        ]);
        const campaignerIds = (campaignerLinks || []).map((row) => row.campaigner_id);
        const salesIds = (salesLinks || []).map((row) => row.sales_person_id);
        const orParts: string[] = [];
        if (campaignerIds.length > 0) {
          orParts.push(`campaigner_id.in.(${campaignerIds.join(",")})`);
        }
        if (salesIds.length > 0) {
          orParts.push(`sales_person_id.in.(${salesIds.join(",")})`);
        }
        if (orParts.length > 0) {
          const { data: linked } = await supabase
            .from("profiles")
            .select("id")
            .or(orParts.join(","));
          (linked || []).forEach((row) => {
            if (row.id) ids.add(row.id);
          });
        }
      }

      const idList = Array.from(ids);
      if (idList.length === 0) return [];

      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", idList)
        .not("email", "is", null)
        .order("full_name");
      if (error) throw error;

      return (profiles || [])
        .filter((row): row is MeetingTeamMember => Boolean(row.email && row.email.trim()))
        .map((row) => ({
          id: row.id,
          full_name: row.full_name,
          email: row.email.trim(),
        }));
    },
    enabled: !!tenantId && (options?.enabled ?? true),
    staleTime: 5 * 60 * 1000,
  });
}
