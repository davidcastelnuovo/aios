import { createContext, useContext, useState, ReactNode, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface AgencyContextType {
  selectedAgency: string;
  setSelectedAgency: (agencyId: string) => void;
}

const AgencyContext = createContext<AgencyContextType | undefined>(undefined);

export function AgencyProvider({ children }: { children: ReactNode }) {
  const [selectedAgency, setSelectedAgency] = useState<string>("all");
  const didSetDefault = useRef(false);

  // Get all active agencies
  const { data: agencies } = useQuery({
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

  // Set the first agency as default ONCE if there's only one agency
  useEffect(() => {
    if (!didSetDefault.current && selectedAgency === "all" && agencies && agencies.length === 1) {
      console.log("Setting default agency:", agencies[0]);
      setSelectedAgency(agencies[0].id);
      didSetDefault.current = true;
    }
  }, [agencies, selectedAgency]);

  return (
    <AgencyContext.Provider value={{ selectedAgency, setSelectedAgency }}>
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
