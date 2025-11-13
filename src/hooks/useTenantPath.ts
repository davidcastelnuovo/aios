import { useParams } from "react-router-dom";
import { useTenant } from "@/contexts/TenantContext";

/**
 * Hook to generate tenant-scoped paths
 * Always use this hook when creating navigation links to ensure proper slug-based routing
 */
export function useTenantPath() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { currentTenantSlug } = useTenant();
  
  // Use slug from URL params first, then from context
  const activeSlug = tenantSlug || currentTenantSlug;

  /**
   * Creates a tenant-scoped path
   * @param path - The page path (e.g., "dashboard", "clients")
   * @returns Full path with tenant slug (e.g., "/t/myorg/dashboard")
   */
  const buildPath = (path: string): string => {
    if (!activeSlug) {
      console.warn("useTenantPath: No tenant slug available, returning root path");
      return `/${path}`;
    }
    
    // Remove leading slash if present
    const cleanPath = path.startsWith("/") ? path.slice(1) : path;
    return `/t/${activeSlug}/${cleanPath}`;
  };

  return {
    buildPath,
    tenantSlug: activeSlug,
    isReady: !!activeSlug,
  };
}
