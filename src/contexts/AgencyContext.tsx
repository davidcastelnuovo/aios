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
  const [selectedAgency, setSelectedAgency] = useState<string>("all");
  const didSetDefault = useRef(false);
  const { userAgencyIds, isOwner, isLoading: isLoadingUserAgencies } = useUserAgencies();

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
  const agencies = !isOwner && userAgencyIds && userAgencyIds.length > 0
    ? allAgencies?.filter(a => userAgencyIds.includes(a.id))
    : allAgencies;

  const isLoading = isLoadingUserAgencies || isLoadingAgencies;

  console.log("AgencyContext - User agencies:", { isOwner, userAgencyIds, filteredAgencies: agencies?.length });

  // Set the first agency as default ONCE if there's only one agency
  useEffect(() => {
    if (!didSetDefault.current && selectedAgency === "all" && agencies && agencies.length === 1) {
      console.log("Setting default agency:", agencies[0]);
      setSelectedAgency(agencies[0].id);
      didSetDefault.current = true;
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
