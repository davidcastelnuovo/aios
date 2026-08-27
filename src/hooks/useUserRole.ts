import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "./useCurrentTenant";
import { useViewAs } from "@/contexts/ViewAsContext";

export type UserRole = "owner" | "team_manager" | "campaigner" | "sales_person" | "super_admin" | "seo";

export function useUserRole() {
  const { tenantId } = useCurrentTenant();
  const { isViewingAs, viewAsUserId } = useViewAs();
  
  const { data: session } = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
    staleTime: Infinity, // Session shouldn't change often
    refetchOnWindowFocus: false,
  });

  const effectiveUserId = isViewingAs ? viewAsUserId : session?.user?.id;

  const {
    data: roles,
    isPending: rolesPending,
    isFetching: rolesFetching,
    isError: rolesError,
  } = useQuery({
    queryKey: ["user-roles", effectiveUserId, tenantId, isViewingAs],
    queryFn: async () => {
      if (!effectiveUserId) return [];
      
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", effectiveUserId)
        .or(`tenant_id.eq.${tenantId},tenant_id.is.null`);

      if (error) throw error;
      return (data || []).map((r) => r.role as UserRole);
    },
    enabled: !!effectiveUserId && !!tenantId,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  });

  // Any role can be linked to a campaigner record (including owners/managers).
  // Load it for every effective user so self-assigned tasks are identified
  // consistently and can expose the opt-in reminder control.
  const { data: campaignerId } = useQuery({
    queryKey: ["user-campaigner-id", effectiveUserId],
    queryFn: async () => {
      if (!effectiveUserId) return null;
      const { data } = await supabase
        .from("profiles")
        .select("campaigner_id")
        .eq("id", effectiveUserId)
        .maybeSingle();
      return data?.campaigner_id || null;
    },
    enabled: !!effectiveUserId,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  // Lazy-load sales person agencies only when user has sales_person role
  const isSalesPersonRole = roles?.includes("sales_person") || false;
  const { data: salesPersonAgencyIds } = useQuery({
    queryKey: ["user-sales-person-agency-ids", effectiveUserId],
    queryFn: async () => {
      if (!effectiveUserId) return null;
      const { data: profile } = await supabase
        .from("profiles")
        .select("sales_person_id")
        .eq("id", effectiveUserId)
        .maybeSingle();
      
      if (!profile?.sales_person_id) return null;
      
      const { data: agencies } = await supabase
        .from("sales_person_agencies")
        .select("agency_id")
        .eq("sales_person_id", profile.sales_person_id);
      
      return agencies?.map(a => a.agency_id) || null;
    },
    enabled: !!effectiveUserId && isSalesPersonRole,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  const {
    data: tenantMembership,
    isPending: membershipPending,
  } = useQuery({
    queryKey: ["tenant-membership-role", effectiveUserId, tenantId],
    queryFn: async () => {
      if (!effectiveUserId || !tenantId) return null;
      const { data, error } = await supabase
        .from("tenant_users")
        .select("role")
        .eq("user_id", effectiveUserId)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (error) throw error;
      return data?.role ?? null;
    },
    enabled: !!effectiveUserId && !!tenantId,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  const hasRole = (role: UserRole) => roles?.includes(role) || false;
  const isTenantOwner = tenantMembership === "owner" || tenantMembership === "agency_owner";

  return {
    roles: roles || [],
    isOwner: hasRole("owner") || tenantMembership === "owner",
    isAgencyOwner: hasRole("agency_owner") || tenantMembership === "agency_owner",
    isTeamManager: hasRole("team_manager"),
    isCampaigner: hasRole("campaigner"),
    isSalesPerson: hasRole("sales_person"),
    isSuperAdmin: hasRole("super_admin"),
    isSeo: hasRole("seo"),
    isLoading: rolesPending || membershipPending,
    isFetching: rolesFetching,
    isError: rolesError,
    isReady: roles !== undefined,
    userId: effectiveUserId,
    authenticatedUserId: session?.user?.id,
    userEmail: session?.user?.email,
    campaignerId,
    salesPersonAgencyIds,
  };
}
