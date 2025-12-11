import { useEffect, useMemo, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";

/**
 * Stable fetch of user tenants via backend function, only after auth token is ready.
 * Filters out invalid entries and keeps previous data to avoid flicker.
 * Now includes currentTenantId to scope the results based on URL context.
 */
export function useUserTenants(userId?: string | null) {
  const [token, setToken] = useState<string | null>(null);
  const { currentTenantId } = useTenant();

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (mounted) setToken(session?.access_token ?? null);
    };

    const { data: subscription } = supabase.auth.onAuthStateChange((_e, session) => {
      setToken(session?.access_token ?? null);
    });

    init();

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const query = useQuery({
    queryKey: ["user-tenants", userId, token, currentTenantId],
    enabled: !!userId && !!token,
    queryFn: async () => {
      console.log("🔄 Fetching user tenants with scope:", currentTenantId);
      
      const { data, error } = await supabase.functions.invoke("list-user-tenants", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: {
          scope_tenant_id: currentTenantId,
        },
      });

      if (error) {
        console.error("Error fetching user tenants:", error);
        return [] as any[];
      }

      const tenants = (data as any)?.tenants;
      // Ensure tenants is always an array before filtering
      if (!Array.isArray(tenants)) {
        console.warn("Tenants data is not an array:", tenants);
        return [] as any[];
      }
      
      console.log(`✅ Received ${tenants.length} tenants from backend`);
      // sanitize
      return tenants.filter((t: any) => t && t.id && t.name);
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 2,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    placeholderData: keepPreviousData,
  });

  return useMemo(() => ({
    userTenants: (query.data as any[]) ?? [],
    isLoading: query.isLoading || query.isFetching,
    refetch: query.refetch,
  }), [query.data, query.isLoading, query.isFetching, query.refetch]);
}
