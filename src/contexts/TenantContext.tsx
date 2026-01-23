import { createContext, useContext, useState, ReactNode, useEffect, useRef } from "react";
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
  const [currentTenantId, setCurrentTenantId] = useState<string | null>(null);
  const [isActiveTenantSynced, setIsActiveTenantSynced] = useState(false);
  const previousTenantIdRef = useRef<string | null>(null);

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
    staleTime: 1000 * 60 * 5,
  });

  // CRITICAL: When URL has tenant slug, use it immediately - no localStorage fallback
  useEffect(() => {
    if (tenantFromSlug?.id) {
      const newTenantId = tenantFromSlug.id;
      const isChange = previousTenantIdRef.current !== null && previousTenantIdRef.current !== newTenantId;
      
      if (isChange) {
        console.log("🔄 Tenant changed from", previousTenantIdRef.current, "to", newTenantId);
        // Mark as NOT synced - this will trigger sync effect
        setIsActiveTenantSynced(false);
      }
      
      if (currentTenantId !== newTenantId) {
        setCurrentTenantId(newTenantId);
      }
      
      previousTenantIdRef.current = newTenantId;
    }
  }, [tenantFromSlug?.id]);

  // Sync tenant to database and clear cache
  useEffect(() => {
    const syncTenantToDb = async () => {
      if (!currentTenantId) {
        setIsActiveTenantSynced(false);
        return;
      }

      // Already synced for this tenant
      if (isActiveTenantSynced) {
        return;
      }

      try {
        console.log("🔄 Syncing tenant to DB:", currentTenantId);
        
        // CRITICAL: Cancel all queries and clear cache FIRST
        await queryClient.cancelQueries();
        
        // Clear all tenant-specific data
        const keysToRemove = [
          "tasks", "clients", "agencies", "agencies-filter", "user-agency-ids",
          "leads", "campaigners", "client-onboarding", "finance", "sales-people",
          "suppliers", "products", "automations", "time-entries", "chat-contacts",
          "crm-tables", "crm-records", "tenant-for-operations"
        ];
        
        keysToRemove.forEach(key => {
          queryClient.removeQueries({ queryKey: [key] });
        });
        
        // Also invalidate to force refetch
        await queryClient.invalidateQueries({ queryKey: ["agencies-filter"] });
        await queryClient.invalidateQueries({ queryKey: ["tenant-for-operations"] });
        
        // Update localStorage
        localStorage.setItem("selectedTenantId", currentTenantId);
        
        // Update user_active_tenant in database
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
          
          // Small delay to ensure DB processed the update
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // Mark as synced AFTER everything completes
        setIsActiveTenantSynced(true);
        
      } catch (error) {
        console.error("Error syncing tenant:", error);
        // Still mark as synced to unblock UI
        setIsActiveTenantSynced(true);
      }
    };
    
    syncTenantToDb();
  }, [currentTenantId, isActiveTenantSynced, queryClient]);

  // Get current user's tenant if not on tenant-scoped route
  const { data: userTenant, isLoading: isLoadingUserTenant } = useQuery({
    queryKey: ["user-tenant"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: userTenants, error: tenantsError } = await supabase
        .from("tenant_users")
        .select("tenant_id, tenants(id, name, slug, status)")
        .eq("user_id", user.id);

      if (tenantsError || !userTenants || userTenants.length === 0) {
        return null;
      }

      const { data: activeTenant } = await (supabase as any)
        .from("user_active_tenant")
        .select("tenant_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (activeTenant) {
        const matchingTenant = userTenants.find((t: any) => t.tenant_id === activeTenant.tenant_id);
        if (matchingTenant) {
          return matchingTenant as any;
        }
      }

      return userTenants[0] as any;
    },
    staleTime: 1000 * 60 * 5,
    enabled: !tenantSlug,
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
      
      return data;
    },
    enabled: !!currentTenantId,
  });

  // Set default tenant from user's tenant if not on tenant route
  useEffect(() => {
    if (!tenantSlug && !currentTenantId && userTenant?.tenant_id) {
      setCurrentTenantId(userTenant.tenant_id);
      previousTenantIdRef.current = userTenant.tenant_id;
    }
  }, [tenantSlug, currentTenantId, userTenant]);

  // Redirect to tenant-scoped route if needed
  useEffect(() => {
    const path = window.location.pathname;
    const isPublicRoute = ['/', '/auth', '/signup', '/landing', '/setup', '/privacy', '/terms'].includes(path);
    const isAlreadyTenantScoped = path.startsWith('/t/');
    
    if (!isPublicRoute && !isAlreadyTenantScoped && currentTenant?.slug) {
      const page = path.slice(1) || 'dashboard';
      navigate(`/t/${currentTenant.slug}/${page}`, { replace: true });
    }
  }, [currentTenant?.slug, navigate]);

  // CRITICAL: URL Auto-Fix - "DB wins" strategy
  // If the URL slug doesn't match the active tenant in the database, fix the URL
  useEffect(() => {
    const fixUrlMismatch = async () => {
      // Only check when we're on a tenant-scoped route with synced state
      if (!tenantSlug || !isActiveTenantSynced || !currentTenantId) return;
      
      // Check if the URL tenant matches the current active tenant
      if (tenantFromSlug?.id && tenantFromSlug.id === currentTenantId) {
        // All good - URL matches active tenant
        return;
      }
      
      // URL doesn't match - get the correct tenant slug from DB
      const { data: correctTenant } = await supabase
        .from("tenants")
        .select("slug")
        .eq("id", currentTenantId)
        .maybeSingle();
      
      if (correctTenant?.slug && correctTenant.slug !== tenantSlug) {
        console.log("🔧 URL mismatch detected! URL has:", tenantSlug, "but active tenant is:", correctTenant.slug);
        
        // Fix the URL by replacing the old slug with the correct one
        const currentPath = window.location.pathname;
        const newPath = currentPath.replace(`/t/${tenantSlug}/`, `/t/${correctTenant.slug}/`);
        
        console.log("🔄 Fixing URL from:", currentPath, "to:", newPath);
        
        // Use replace to avoid adding to browser history
        window.location.replace(newPath);
      }
    };
    
    fixUrlMismatch();
  }, [tenantSlug, tenantFromSlug?.id, currentTenantId, isActiveTenantSynced]);

  const isLoading = isLoadingUserTenant || isLoadingTenant || isLoadingSlug;

  // CRITICAL: Block rendering until tenant is synced to DB
  if (currentTenantId && !isActiveTenantSynced) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Block while loading if no tenant yet
  if (isLoading && !currentTenant && !userTenant) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

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