import { createContext, useContext, useState, ReactNode, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";


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

  

  // Persist selection
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, selectedAgency);
    } catch {}
  }, [selectedAgency]);

  // Get all active agencies
  const { data: allAgencies, isLoading: isLoadingAgencies } = useQuery({
    queryKey: ["agencies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agencies")
        .select("id, name")
        .eq("status", "active")
        .order("name");
      
      if (error) {
        console.error("Error fetching agencies:", error);
        return [];
      }
      
      return data;
    },
  });

  // Agencies available globally (independent of user role)
  const agencies = allAgencies;

  const isLoading = isLoadingAgencies;

  console.log("🏢 AgencyContext - state:", { 
    isLoadingAgencies,
    allAgenciesCount: allAgencies?.length,
    agenciesCount: agencies?.length,
    agencies: agencies?.map(a => ({ id: a.id, name: a.name })),
  });

  // Ensure a valid selection and sensible defaults
  useEffect(() => {
    if (!agencies || agencies.length === 0) return;

    const exists = selectedAgency === "all" || agencies.some((a) => a.id === selectedAgency);

    if (!exists) {
      // If current selection is invalid, prefer "all" when multiple agencies exist
      if (agencies.length > 1) {
        setSelectedAgency("all");
      } else {
        setSelectedAgency(agencies[0].id);
      }
      didSetDefault.current = true;
      return;
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
