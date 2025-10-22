import { createContext, useContext, useState, ReactNode, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserAgencies } from "@/hooks/useUserAgencies";

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

  const { userAgencyIds, isOwner, isLoading: isLoadingUserAgencies } = useUserAgencies();

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

  // Filter agencies based on user access
  // Wait for user data to load before filtering
  const agencies = isLoadingUserAgencies 
    ? undefined  // Still loading user data, don't show anything yet
    : (isOwner || userAgencyIds === null
        ? allAgencies  // Owner sees all (userAgencyIds is null for owners)
        : allAgencies?.filter(a => userAgencyIds.includes(a.id))); // Filter by user's agencies

  const isLoading = isLoadingUserAgencies || isLoadingAgencies;

  console.log("AgencyContext - User agencies:", { 
    isOwner, 
    userAgencyIds, 
    isLoadingUserAgencies,
    allAgenciesCount: allAgencies?.length,
    filteredAgencies: agencies?.length 
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

  return (
    <AgencyContext.Provider value={{ selectedAgency, setSelectedAgency, agencies, isLoading }}>
      {children}
    </AgencyContext.Provider>
  );
}

export function useAgency() {
  const context = useContext(AgencyContext);
  if (context === undefined) {
    throw new Error("useAgency must be used within an AgencyProvider");
  }
  return context;
}
