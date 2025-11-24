import { useTenant } from "@/contexts/TenantContext";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook to get the current tenant ID
 * This ensures all data queries are scoped to the current tenant
 * CRITICAL: Always prioritizes tenant from URL route over context
 */
export function useCurrentTenant() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { currentTenantId, currentTenant, isLoading: contextLoading } = useTenant();
  
  // If we're on a tenant-scoped route, fetch tenant directly from URL slug
  const { data: urlTenant, isLoading: urlLoading } = useQuery({
    queryKey: ["tenant-for-operations", tenantSlug],
    queryFn: async () => {
      if (!tenantSlug) return null;
      
      const { data, error } = await supabase
        .from("tenants")
        .select("id, name, slug")
        .eq("slug", tenantSlug)
        .maybeSingle();
      
      if (error) {
        console.error("Error fetching tenant by slug:", error);
        return null;
      }
      
      return data;
    },
    enabled: !!tenantSlug,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
  
  // CRITICAL: URL tenant always takes precedence
  const effectiveTenantId = urlTenant?.id || currentTenantId;
  const effectiveTenant = urlTenant || currentTenant;
  const isLoading = tenantSlug ? urlLoading : contextLoading;
  
  return {
    tenantId: effectiveTenantId,
    tenant: effectiveTenant,
    isLoading,
  };
}