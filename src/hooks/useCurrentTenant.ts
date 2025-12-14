import { useTenant } from "@/contexts/TenantContext";

/**
 * Hook to get the current tenant ID
 * This ensures all data queries are scoped to the current tenant
 * CRITICAL: Uses TenantContext which already handles URL priority
 */
export function useCurrentTenant() {
  const { currentTenantId, currentTenant, isLoading, isActiveTenantSynced } = useTenant();
  
  return {
    tenantId: currentTenantId,
    tenant: currentTenant,
    isLoading,
    isActiveTenantSynced,
  };
}