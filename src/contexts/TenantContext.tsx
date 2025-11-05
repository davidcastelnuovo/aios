import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface TenantContextType {
  currentTenantId: string | null;
  setCurrentTenantId: (tenantId: string) => void;
  currentTenant: any;
  isLoading: boolean;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: ReactNode }) {
  const [currentTenantId, setCurrentTenantId] = useState<string | null>(() => {
    try {
      return localStorage.getItem("selectedTenantId");
    } catch {
      return null;
    }
  });

  // Persist tenant selection
  useEffect(() => {
    const updateActiveTenant = async () => {
      try {
        if (currentTenantId) {
          localStorage.setItem("selectedTenantId", currentTenantId);
          
          // Update user_active_tenant in the database
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await (supabase as any)
              .from("user_active_tenant")
              .upsert({
                user_id: user.id,
                tenant_id: currentTenantId,
                updated_at: new Date().toISOString(),
              }, {
                onConflict: "user_id"
              });
          }
        } else {
          localStorage.removeItem("selectedTenantId");
        }
      } catch (error) {
        console.error("Error updating active tenant:", error);
      }
    };
    
    updateActiveTenant();
  }, [currentTenantId]);

  // Get current user's active tenant (priority) or first tenant
  const { data: userTenant, isLoading: isLoadingUserTenant } = useQuery({
    queryKey: ["user-tenant"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      // First, try to get the active tenant from user_active_tenant
      const { data: activeTenant, error: activeTenantError } = await (supabase as any)
        .from("user_active_tenant")
        .select("tenant_id, tenants(id, name, status)")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!activeTenantError && activeTenant) {
        console.log("Found active tenant:", activeTenant);
        return activeTenant as any;
      }

      // If no active tenant, get the first available tenant
      const { data, error } = await supabase
        .from("tenant_users")
        .select("tenant_id, tenants(id, name, status)")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      
      if (error) {
        console.error("Error fetching user tenant:", error);
        return null;
      }
      
      console.log("Using first available tenant:", data);
      return data as any;
    },
    staleTime: 1000 * 60 * 5,
  });

  // Get current tenant details
  const { data: currentTenant, isLoading: isLoadingTenant } = useQuery({
    queryKey: ["current-tenant", currentTenantId],
    queryFn: async () => {
      if (!currentTenantId) return null;

      const { data, error } = await supabase
        .from("tenants")
        .select("*")
        .eq("id", currentTenantId)
        .single();
      
      if (error) {
        console.error("Error fetching current tenant:", error);
        return null;
      }
      
      return data;
    },
    enabled: !!currentTenantId,
  });

  // Set default tenant from user's tenant if not already set
  useEffect(() => {
    if (!currentTenantId && userTenant?.tenant_id) {
      setCurrentTenantId(userTenant.tenant_id);
    }
  }, [currentTenantId, userTenant]);

  const isLoading = isLoadingUserTenant || isLoadingTenant;

  // Wait for initial loading
  if (isLoading && !currentTenant && !userTenant) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <TenantContext.Provider 
      value={{ 
        currentTenantId, 
        setCurrentTenantId, 
        currentTenant: currentTenant || userTenant?.tenants,
        isLoading 
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