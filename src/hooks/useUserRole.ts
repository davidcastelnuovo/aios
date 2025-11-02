import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type UserRole = "owner" | "team_manager" | "campaigner" | "sales_person" | "super_admin";

export function useUserRole() {
  const { data: session } = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
    staleTime: Infinity, // Session shouldn't change often
    refetchOnWindowFocus: false,
  });

  const { data: roles, isLoading } = useQuery({
    queryKey: ["user-roles", session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return [];
      
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id);

      if (error) throw error;
      return data.map((r) => r.role as UserRole);
    },
    enabled: !!session?.user?.id,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    refetchOnWindowFocus: false,
  });

  const { data: campaignerId } = useQuery({
    queryKey: ["user-campaigner-id", session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return null;
      const { data } = await supabase
        .from("profiles")
        .select("campaigner_id")
        .eq("id", session.user.id)
        .maybeSingle();
      return data?.campaigner_id || null;
    },
    enabled: !!session?.user?.id,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    refetchOnWindowFocus: false,
  });

  const { data: salesPersonAgencyIds } = useQuery({
    queryKey: ["user-sales-person-agency-ids", session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return null;
      const { data: profile } = await supabase
        .from("profiles")
        .select("sales_person_id")
        .eq("id", session.user.id)
        .maybeSingle();
      
      if (!profile?.sales_person_id) return null;
      
      const { data: agencies } = await supabase
        .from("sales_person_agencies")
        .select("agency_id")
        .eq("sales_person_id", profile.sales_person_id);
      
      return agencies?.map(a => a.agency_id) || null;
    },
    enabled: !!session?.user?.id,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    refetchOnWindowFocus: false,
  });

  const hasRole = (role: UserRole) => roles?.includes(role) || false;

  return {
    roles: roles || [],
    isOwner: hasRole("owner"),
    isTeamManager: hasRole("team_manager"),
    isCampaigner: hasRole("campaigner"),
    isSalesPerson: hasRole("sales_person"),
    isSuperAdmin: hasRole("super_admin"),
    isLoading,
    userId: session?.user?.id,
    userEmail: session?.user?.email,
    campaignerId,
    salesPersonAgencyIds,
  };
}
