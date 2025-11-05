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
    try {
      if (currentTenantId) {
        localStorage.setItem("selectedTenantId", currentTenantId);
      } else {
        localStorage.removeItem("selectedTenantId");
      }
    } catch {}
  }, [currentTenantId]);

  // Get current user's tenant
  const { data: userTenant, isLoading: isLoadingUserTenant } = useQuery({
    queryKey: ["user-tenant"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from("tenant_users")
        .select("tenant_id, tenants(id, name, status)")
        .eq("user_id", user.id)
        .single();
      
      if (error) {
        console.error("Error fetching user tenant:", error);
        return null;
      }
      
      return data;
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