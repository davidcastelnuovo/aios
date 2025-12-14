import { createContext, useContext, useState, ReactNode, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserAgencies } from "@/hooks/useUserAgencies";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";

interface AgencyContextType {
  selectedAgency: string;
  setSelectedAgency: (agencyId: string) => void;
  agencies: Array<{ id: string; name: string }> | undefined;
  isLoading: boolean;
}

const AgencyContext = createContext<AgencyContextType | undefined>(undefined);

export function AgencyProvider({ children }: { children: ReactNode }) {
  const storageKey = "selectedAgencyId";
  const getInitialSelectedAgency = () => {
    try {
      return localStorage.getItem(storageKey) || "all";
    } catch {
      return "all";
    }
  };
  const [selectedAgency, setSelectedAgency] = useState<string>(getInitialSelectedAgency());
  const didSetDefault = useRef(false);
  const { userAgencyIds } = useUserAgencies();
  const { tenantId } = useCurrentTenant();

  // Persist selection
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, selectedAgency);
    } catch {}
  }, [selectedAgency]);

  // Get all agencies for the filter - including shared agencies
  const { data: allAgencies, isLoading: isLoadingAgencies } = useQuery({
    queryKey: ["agencies-filter", tenantId],
    queryFn: async () => {
      if (!tenantId) return [] as any[];
      
      // Get agencies owned by current tenant
      const { data: ownedAgencies, error: ownedError } = await supabase
        .from("agencies")
        .select("id, name")
        .eq("tenant_id", tenantId)
        .order("name");
      
      if (ownedError) {
        console.error("Error fetching owned agencies:", ownedError);
        return [];
      }
      
      // Get shared agencies via agency_tenant_access
      const { data: sharedAccess, error: sharedError } = await supabase
        .from("agency_tenant_access")
        .select("agency_id, agencies(id, name)")
        .eq("accessing_tenant_id", tenantId);
      
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
      
      return Array.from(uniqueMap.values()).sort((a, b) => 
        a.name.localeCompare(b.name)
      );
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
    enabled: !!tenantId,
  });

  // Agencies available (RLS-filtered)
  const agencies = allAgencies;

  const isLoading = isLoadingAgencies;

  // Reset selection when tenant changes
  const prevTenantIdRef = useRef(tenantId);
  useEffect(() => {
    if (tenantId && prevTenantIdRef.current && tenantId !== prevTenantIdRef.current) {
      // Tenant changed - reset to "all"
      setSelectedAgency("all");
      didSetDefault.current = false;
    }
    prevTenantIdRef.current = tenantId;
  }, [tenantId]);

  // Ensure a valid selection and sensible defaults
  useEffect(() => {
    if (!agencies || agencies.length === 0) return;

    // If only ONE agency exists, always select it (not "all")
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
  if (isLoading && !agencies) {
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
    // Safe fallback to avoid crashes before AgencyProvider mounts
    return {
      selectedAgency: "all",
      setSelectedAgency: () => {},
      agencies: undefined,
      isLoading: true,
    };
  }
  return context;
}
