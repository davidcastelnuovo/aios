import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface TenantContextType {
  currentTenantId: string | null;
  currentTenantSlug: string | null;
  setCurrentTenantId: (tenantId: string) => void;
  currentTenant: any;
  isLoading: boolean;
  isActiveTenantSynced: boolean;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { tenantSlug } = useParams();
  const navigate = useNavigate();
  const [currentTenantId, setCurrentTenantId] = useState<string | null>(() => {
    try {
      return localStorage.getItem("selectedTenantId");
    } catch {
      return null;
    }
  });

  // Get tenant by slug from URL
  const { data: tenantFromSlug, isLoading: isLoadingSlug } = useQuery({
    queryKey: ["tenant-by-slug", tenantSlug],
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
  });

  // State to track if the active tenant has been synced to DB
  const [isActiveTenantSynced, setIsActiveTenantSynced] = useState(false);

  // Update currentTenantId when URL slug changes
  useEffect(() => {
    if (tenantFromSlug?.id && tenantFromSlug.id !== currentTenantId) {
      setIsActiveTenantSynced(false); // Mark as not synced when tenant changes
      setCurrentTenantId(tenantFromSlug.id);
    }
  }, [tenantFromSlug, currentTenantId]);

  // Persist tenant selection and clear cache when tenant changes
  // CRITICAL: This must complete BEFORE data is fetched
  useEffect(() => {
    const updateActiveTenant = async () => {
      try {
        if (currentTenantId) {
          localStorage.setItem("selectedTenantId", currentTenantId);
          
          // CRITICAL: Clear all cached data FIRST before updating DB
          // This ensures old data is not shown while we update the tenant
          console.log("🔄 Clearing cache before tenant sync:", currentTenantId);
          await queryClient.cancelQueries();
          queryClient.removeQueries({ queryKey: ["tasks"] });
          queryClient.removeQueries({ queryKey: ["clients"] });
          queryClient.removeQueries({ queryKey: ["agencies"] });
          queryClient.removeQueries({ queryKey: ["agencies-filter"] });
          queryClient.removeQueries({ queryKey: ["user-agency-ids"] });
          queryClient.removeQueries({ queryKey: ["leads"] });
          queryClient.removeQueries({ queryKey: ["campaigners"] });
          queryClient.removeQueries({ queryKey: ["client-onboarding"] });
          queryClient.removeQueries({ queryKey: ["finance"] });
          queryClient.removeQueries({ queryKey: ["sales-people"] });
          queryClient.removeQueries({ queryKey: ["suppliers"] });
          queryClient.removeQueries({ queryKey: ["products"] });
          queryClient.removeQueries({ queryKey: ["automations"] });
          queryClient.removeQueries({ queryKey: ["time-entries"] });
          
          // Update user_active_tenant in the database - MUST complete for RLS to work correctly
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { error } = await (supabase as any)
              .from("user_active_tenant")
              .upsert({
                user_id: user.id,
                tenant_id: currentTenantId,
                updated_at: new Date().toISOString(),
              }, {
                onConflict: "user_id"
              });
            
            if (error) {
              console.error("Error updating active tenant in DB:", error);
            } else {
              console.log("✅ Active tenant synced to DB:", currentTenantId);
            }
            
            // Add a small delay to ensure DB has processed the update
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          
          // Mark as synced AFTER the DB update completes
          setIsActiveTenantSynced(true);
        } else {
          localStorage.removeItem("selectedTenantId");
          setIsActiveTenantSynced(false);
        }
      } catch (error) {
        console.error("Error updating active tenant:", error);
        setIsActiveTenantSynced(true); // Still allow loading even if DB update fails
      }
    };
    
    updateActiveTenant();
  }, [currentTenantId, queryClient]);

  // Get current user's active tenant (priority) or first tenant
  const { data: userTenant, isLoading: isLoadingUserTenant } = useQuery({
    queryKey: ["user-tenant"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      // Get all user's tenants
      const { data: userTenants, error: tenantsError } = await supabase
        .from("tenant_users")
        .select("tenant_id, tenants(id, name, slug, status)")
        .eq("user_id", user.id);

      if (tenantsError || !userTenants || userTenants.length === 0) {
        console.log("No tenants found for user");
        return null;
      }

      // Try to get the active tenant from user_active_tenant
      const { data: activeTenant, error: activeTenantError } = await (supabase as any)
        .from("user_active_tenant")
        .select("tenant_id")
        .eq("user_id", user.id)
        .maybeSingle();

      // Check if active tenant is in user's available tenants
      if (!activeTenantError && activeTenant) {
        const matchingTenant = userTenants.find((t: any) => t.tenant_id === activeTenant.tenant_id);
        if (matchingTenant) {
          console.log("Found active tenant:", matchingTenant);
          return matchingTenant as any;
        }
      }

      // Otherwise return first available tenant
      console.log("Using first available tenant:", userTenants[0]);
      return userTenants[0] as any;
    },
    staleTime: 1000 * 60 * 5,
    enabled: !tenantSlug, // Only fetch if not in tenant-scoped route
  });

  // Get current tenant details
  const { data: currentTenant, isLoading: isLoadingTenant } = useQuery({
    queryKey: ["current-tenant", currentTenantId],
    queryFn: async () => {
      if (!currentTenantId) return null;

      const { data, error } = await supabase
        .from("tenants")
        .select("id, name, slug, allow_super_admin_access")
        .eq("id", currentTenantId)
        .maybeSingle();
      
      if (error) {
        console.error("Error fetching current tenant:", error);
        return null;
      }
      
      if (!data) {
        console.warn("No tenant found for ID:", currentTenantId);
        return null;
      }
      
      return data;
    },
    enabled: !!currentTenantId,
    retry: 2,
    retryDelay: 500,
  });

  // Set default tenant from user's tenant if not already set (for non-tenant routes)
  useEffect(() => {
    if (!tenantSlug && !currentTenantId && userTenant?.tenant_id) {
      setCurrentTenantId(userTenant.tenant_id);
    }
  }, [tenantSlug, currentTenantId, userTenant]);

  // Redirect to tenant-scoped route if we have a tenant but no slug in URL
  useEffect(() => {
    const path = window.location.pathname;
    const isPublicRoute = ['/auth', '/signup', '/landing', '/setup'].includes(path);
    const isAlreadyTenantScoped = path.startsWith('/t/');
    
    // Only redirect if not public, not already tenant-scoped, and we have a tenant slug
    if (!isPublicRoute && !isAlreadyTenantScoped && currentTenant?.slug) {
      // Extract page from current path (remove leading slash) or default to dashboard
      const page = path.slice(1) || 'dashboard';
      console.log("🔄 Redirecting to tenant-scoped route:", `/t/${currentTenant.slug}/${page}`);
      navigate(`/t/${currentTenant.slug}/${page}`, { replace: true });
    }
  }, [currentTenant?.slug, navigate]);

  const isLoading = isLoadingUserTenant || isLoadingTenant || isLoadingSlug;

  // Wait for initial loading OR wait for active tenant to sync to DB
  if ((isLoading && !currentTenant && !userTenant) || (currentTenantId && !isActiveTenantSynced)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // CRITICAL: When on tenant-scoped route, ALWAYS use tenant from URL
  const effectiveTenantId = tenantFromSlug?.id || currentTenantId;
  const effectiveTenant = tenantFromSlug || currentTenant || userTenant?.tenants;

  return (
    <TenantContext.Provider 
      value={{ 
        currentTenantId: effectiveTenantId, 
        currentTenantSlug: effectiveTenant?.slug || null,
        setCurrentTenantId, 
        currentTenant: effectiveTenant,
        isLoading,
        isActiveTenantSynced
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error("useTenant must be used within a TenantProvider");
  }
  return context;
}