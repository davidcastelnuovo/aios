import { useTenant } from "@/contexts/TenantContext";

/**
 * Hook to get the current tenant ID
 * This ensures all data queries are scoped to the current tenant
 */
export function useCurrentTenant() {
  const { currentTenantId, currentTenant, isLoading } = useTenant();
  
  return {
    tenantId: currentTenantId,
    tenant: currentTenant,
    isLoading,
  };
}