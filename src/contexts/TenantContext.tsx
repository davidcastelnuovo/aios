import { createContext, useContext, useState, ReactNode, useEffect, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useLocation } from "react-router-dom";
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

function getSlugFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/t\/([^/]+)/);
  return match ? match[1] : null;
}

export function TenantProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();

  // Parse tenantSlug directly from URL instead of useParams (which doesn't work outside Routes)
  const [tenantSlug, setTenantSlug] = useState<string | null>(() => getSlugFromPath(window.location.pathname));

  const [currentTenantId, setCurrentTenantId] = useState<string | null>(() => localStorage.getItem("selectedTenantId"));
  const [isActiveTenantSynced, setIsActiveTenantSynced] = useState(false);
  const [isBootstrapTimedOut, setIsBootstrapTimedOut] = useState(false);
  const previousTenantIdRef = useRef<string | null>(null);

  // Update tenantSlug when location changes (react-router navigation)
  useEffect(() => {
    const newSlug = getSlugFromPath(location.pathname);
    if (newSlug !== tenantSlug) {
      setTenantSlug(newSlug);
    }
  }, [location.pathname, tenantSlug]);

  // Also listen for popstate (back/forward) and programmatic navigation
  useEffect(() => {
    const handleLocationChange = () => {
      const newSlug = getSlugFromPath(window.location.pathname);
      setTenantSlug(prev => prev !== newSlug ? newSlug : prev);
    };

    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

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

  // CRITICAL: "URL wins" strategy - URL is always the source of truth
  useEffect(() => {
    if (tenantFromSlug?.id) {
      const urlTenantId = tenantFromSlug.id;
      
      if (currentTenantId !== urlTenantId) {
        console.log("🔄 URL tenant differs from state. Updating to:", urlTenantId, tenantSlug);
        setCurrentTenantId(urlTenantId);
        setIsActiveTenantSynced(false);
      }
      
      previousTenantIdRef.current = urlTenantId;
    }
  }, [tenantFromSlug?.id, tenantSlug, currentTenantId]);

  // Sync tenant to database and clear cache - AWAIT the DB write
  useEffect(() => {
    const syncTenantToDb = async () => {
      if (!currentTenantId) {
        setIsActiveTenantSynced(false);
        return;
      }

      if (isActiveTenantSynced) {
        return;
      }

      try {
        console.log("🔄 Syncing tenant to DB:", currentTenantId);
        
        const keysToRemove = [
          "tasks", "clients", "agencies", "agencies-filter", "user-agency-ids",
          "leads", "campaigners", "client-onboarding", "finance", "sales-people",
          "suppliers", "products", "automations", "time-entries", "chat-contacts",
          "crm-tables", "crm-records", "tenant-for-operations"
        ];
        
        keysToRemove.forEach(key => {
          queryClient.removeQueries({ queryKey: [key] });
        });
        
        localStorage.setItem("selectedTenantId", currentTenantId);
        
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { error } = await (supabase as any)
            .from("user_active_tenant")
            .upsert({
              user_id: user.id,
              tenant_id: currentTenantId,
              updated_at: new Date().toISOString(),
            }, { onConflict: "user_id" });

          if (error) {
            console.error("Error updating active tenant in DB:", error);
          } else {
            console.log("✅ Active tenant synced to DB:", currentTenantId);
          }
        }
      } catch (error) {
        console.error("Error syncing tenant:", error);
      }

      setIsActiveTenantSynced(true);
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

      const mcTenant = userTenants.find((t: any) => (t as any)?.tenants?.slug === 'marketingcaptain');
      return (mcTenant || userTenants[0]) as any;
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
    const isPublicRoute = ['/', '/auth', '/signup', '/landing', '/setup', '/privacy', '/terms'].includes(path) || path.startsWith('/chat-invite');
    const isAlreadyTenantScoped = path.startsWith('/t/');
    
    if (!isPublicRoute && !isAlreadyTenantScoped && currentTenant?.slug) {
      const page = path.slice(1) || 'dashboard';
      navigate(`/t/${currentTenant.slug}/${page}`, { replace: true });
    }
  }, [currentTenant?.slug, navigate]);

  const isLoading = isLoadingUserTenant || isLoadingTenant || isLoadingSlug;

  useEffect(() => {
    if (currentTenantId || !isLoading) {
      setIsBootstrapTimedOut(false);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      console.warn("⚠️ Tenant bootstrap timed out after 8s, unblocking UI");
      setIsBootstrapTimedOut(true);
    }, 8000);

    return () => window.clearTimeout(timeoutId);
  }, [currentTenantId, isLoading]);

  // CRITICAL: Block rendering until tenant is synced to DB
  if (currentTenantId && !isActiveTenantSynced) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Block while loading if no tenant yet (with fail-safe timeout)
  if (isLoading && !isBootstrapTimedOut && !currentTenant && !userTenant) {
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