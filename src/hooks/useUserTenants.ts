import { useEffect, useMemo, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Stable fetch of user tenants via backend function, only after auth token is ready.
 * Filters out invalid entries and keeps previous data to avoid flicker.
 */
export function useUserTenants(userId?: string | null) {
  const [token, setToken] = useState<string | null>(null);

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
    queryKey: ["user-tenants", userId, token],
    enabled: !!userId && !!token,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("list-user-tenants", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (error) {
        console.error("Error fetching user tenants:", error);
        return [] as any[];
      }

      const tenants = (data as any)?.tenants ?? [];
      // sanitize
      return (tenants as any[]).filter((t) => t && t.id && t.name);
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 2,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  });

  return useMemo(() => ({
    userTenants: (query.data as any[]) ?? [],
    isLoading: query.isLoading || query.isFetching,
    refetch: query.refetch,
  }), [query.data, query.isLoading, query.isFetching, query.refetch]);
}
