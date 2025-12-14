import { createContext, useContext, useState, ReactNode, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";

interface AgencyContextType {
  selectedAgency: string;
  setSelectedAgency: (agencyId: string) => void;
  agencies: Array<{ id: string; name: string }> | undefined;
  isLoading: boolean;
}

const AgencyContext = createContext<AgencyContextType | undefined>(undefined);

export function AgencyProvider({ children }: { children: ReactNode }) {
  const storageKey = "selectedAgencyId";
  const [selectedAgency, setSelectedAgency] = useState<string>("all");
  const didSetDefault = useRef(false);
  const queryClient = useQueryClient();
  
  // CRITICAL: Get tenant info including isActiveTenantSynced
  const { currentTenantId, isActiveTenantSynced } = useTenant();
  const prevTenantIdRef = useRef<string | null>(null);

  // Persist selection
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, selectedAgency);
    } catch {}
  }, [selectedAgency]);

  // Reset selection and refetch when tenant changes
  useEffect(() => {
    if (currentTenantId && prevTenantIdRef.current && currentTenantId !== prevTenantIdRef.current) {
      console.log("🔄 AgencyContext: Tenant changed, resetting to 'all'");
      setSelectedAgency("all");
      didSetDefault.current = false;
      // Force refetch agencies for new tenant
      queryClient.invalidateQueries({ queryKey: ["agencies-filter", currentTenantId] });
    }
    prevTenantIdRef.current = currentTenantId;
  }, [currentTenantId, queryClient]);

  // Get all agencies for the filter - ONLY when tenant is synced
  const { data: allAgencies, isLoading: isLoadingAgencies } = useQuery({
    queryKey: ["agencies-filter", currentTenantId],
    queryFn: async () => {
      if (!currentTenantId) return [] as any[];
      
      console.log("📋 Fetching agencies for tenant:", currentTenantId);
      
      // Get agencies owned by current tenant
      const { data: ownedAgencies, error: ownedError } = await supabase
        .from("agencies")
        .select("id, name")
        .eq("tenant_id", currentTenantId)
        .order("name");
      
      if (ownedError) {
        console.error("Error fetching owned agencies:", ownedError);
        return [];
      }
      
      // Get shared agencies via agency_tenant_access
      const { data: sharedAccess, error: sharedError } = await supabase
        .from("agency_tenant_access")
        .select("agency_id, agencies(id, name)")
        .eq("accessing_tenant_id", currentTenantId);
      
      if (sharedError) {
        console.error("Error fetching shared agencies:", sharedError);
      }
      
      // Combine owned and shared agencies
      const shared = sharedAccess?.map(s => s.agencies).filter(Boolean) || [];
      const combined = [...(ownedAgencies || []), ...shared];
      
      // Remove duplicates and sort
      const uniqueMap = new Map();
      combined.forEach(agency => {
        if (agency && agency.id) {
          uniqueMap.set(agency.id, agency);
        }
      });
      
      const result = Array.from(uniqueMap.values()).sort((a, b) => 
        a.name.localeCompare(b.name)
      );
      
      console.log("✅ Loaded", result.length, "agencies for tenant:", currentTenantId);
      return result;
    },
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
    // CRITICAL: Only enable query when tenant is synced to DB
    enabled: !!currentTenantId && isActiveTenantSynced,
  });

  const agencies = allAgencies;
  const isLoading = isLoadingAgencies;

  // Ensure a valid selection
  useEffect(() => {
    if (!agencies || agencies.length === 0) return;

    // If only ONE agency exists, always select it
    if (agencies.length === 1) {
      if (selectedAgency !== agencies[0].id) {
        setSelectedAgency(agencies[0].id);
        didSetDefault.current = true;
      }
      return;
    }

    // Multiple agencies: validate current selection
    const exists = selectedAgency === "all" || agencies.some((a) => a.id === selectedAgency);
    if (!exists) {
      setSelectedAgency("all");
      didSetDefault.current = true;
    }
  }, [agencies, selectedAgency]);

  // Wait for initial loading before rendering children
  // But only block if tenant is synced and we're still loading
  if (isActiveTenantSynced && isLoading && !agencies) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <AgencyContext.Provider value={{ selectedAgency, setSelectedAgency, agencies, isLoading }}>
      {children}
    </AgencyContext.Provider>
  );
}

export function useAgency() {
  const context = useContext(AgencyContext);
  if (context === undefined) {
    return {
      selectedAgency: "all",
      setSelectedAgency: () => {},
      agencies: undefined,
      isLoading: true,
    };
  }
  return context;
}