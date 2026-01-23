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

  // CRITICAL: "DB wins" strategy - Check DB first before using URL slug
  // This prevents the "stuck URL" issue in Preview iframe where the URL doesn't update
  // but we still want to use the DB's active tenant as the source of truth
  useEffect(() => {
    const checkDbBeforeSync = async () => {
      if (!tenantFromSlug?.id) return;
      
      const urlTenantId = tenantFromSlug.id;
      
      try {
        // First, check what the DB says is the active tenant
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          // No user - just use URL tenant
          if (currentTenantId !== urlTenantId) {
            setCurrentTenantId(urlTenantId);
          }
          previousTenantIdRef.current = urlTenantId;
          return;
        }
        
        const { data: activeRecord } = await (supabase as any)
          .from("user_active_tenant")
          .select("tenant_id")
          .eq("user_id", user.id)
          .maybeSingle();
        
        // If DB has a different tenant than URL, DB WINS - fix the URL
        if (activeRecord?.tenant_id && activeRecord.tenant_id !== urlTenantId) {
          console.log("🔧 DB vs URL mismatch! DB has:", activeRecord.tenant_id, "URL has:", urlTenantId);
          
          // Get the correct slug for the DB tenant
          const { data: correctTenant } = await supabase
            .from("tenants")
            .select("slug")
            .eq("id", activeRecord.tenant_id)
            .maybeSingle();
          
          if (correctTenant?.slug && correctTenant.slug !== tenantSlug) {
            console.log("🔄 Fixing URL to match DB. Redirecting to:", correctTenant.slug);
            
            // Fix the URL - don't update DB state, just redirect
            const currentPath = window.location.pathname;
            const newPath = currentPath.replace(`/t/${tenantSlug}/`, `/t/${correctTenant.slug}/`);
            window.location.replace(newPath);
            return; // Stop here - the redirect will handle the rest
          }
        }
        
        // URL matches DB or DB is empty - proceed normally with URL tenant
        const newTenantId = urlTenantId;
        const isChange = previousTenantIdRef.current !== null && previousTenantIdRef.current !== newTenantId;
        
        if (isChange) {
          console.log("🔄 Tenant changed from", previousTenantIdRef.current, "to", newTenantId);
          setIsActiveTenantSynced(false);
        }
        
        if (currentTenantId !== newTenantId) {
          setCurrentTenantId(newTenantId);
        }
        
        previousTenantIdRef.current = newTenantId;
        
      } catch (error) {
        console.error("Error checking DB tenant:", error);
        // On error, fall back to URL tenant
        if (currentTenantId !== urlTenantId) {
          setCurrentTenantId(urlTenantId);
        }
        previousTenantIdRef.current = urlTenantId;
      }
    };
    
    checkDbBeforeSync();
  }, [tenantFromSlug?.id, tenantSlug]);

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

  // Note: URL Auto-Fix logic moved to checkDbBeforeSync above for earlier execution

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