import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { useUserRole } from "@/hooks/useUserRole";
import { useManagedAgencies } from "@/hooks/useManagedAgencies";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface AgencyContextType {
  selectedAgency: string;
  setSelectedAgency: (agencyId: string) => void;
  managedAgencyIds: string[];
  userAgencyIds: string[];
}

const AgencyContext = createContext<AgencyContextType | undefined>(undefined);

export function AgencyProvider({ children }: { children: ReactNode }) {
  const [selectedAgency, setSelectedAgency] = useState<string>("all");
  const { isAgencyManager, isUser, userId } = useUserRole();
  const { managedAgencies } = useManagedAgencies();

  // Get agencies for regular users based on their campaigner
  const { data: userAgencies } = useQuery({
    queryKey: ["user-agencies", userId],
    queryFn: async () => {
      if (!userId || !isUser) return [];

      const { data: profile } = await supabase
        .from("profiles")
        .select("campaigner_id")
        .eq("id", userId)
        .maybeSingle();

      if (!profile?.campaigner_id) return [];

      const { data, error } = await supabase
        .from("campaigner_agencies")
        .select(`
          agency_id,
          agencies (
            id,
            name
          )
        `)
        .eq("campaigner_id", profile.campaigner_id);

      if (error) {
        console.error("Error fetching user agencies:", error);
        return [];
      }

      return data?.map(item => item.agencies).filter(Boolean) || [];
    },
    enabled: !!userId && isUser,
  });

  const managedAgencyIds = managedAgencies?.map(a => a.id) || [];
  const userAgencyIds = userAgencies?.map(a => a.id) || [];

  console.log("🏢 Agency Context Debug:", {
    selectedAgency,
    isAgencyManager,
    isUser,
    managedAgencies: managedAgencies?.map(a => ({ id: a.id, name: a.name })),
    userAgencies: userAgencies?.map(a => ({ id: a.id, name: a.name })),
    managedAgencyIds,
    userAgencyIds
  });

  // For agency managers and regular users, set the first agency as default if none selected
  useEffect(() => {
    console.log("🔄 Agency Context useEffect:", {
      selectedAgency,
      isAgencyManager,
      isUser,
      managedAgenciesLength: managedAgencies?.length,
      userAgenciesLength: userAgencies?.length
    });
    
    if (selectedAgency === "all") {
      if (isAgencyManager && managedAgencies && managedAgencies.length > 0) {
        console.log("Setting default agency for manager:", managedAgencies[0]);
        setSelectedAgency(managedAgencies[0].id);
      } else if (isUser && userAgencies && userAgencies.length > 0) {
        console.log("Setting default agency for user:", userAgencies[0]);
        setSelectedAgency(userAgencies[0].id);
      }
    }
  }, [isAgencyManager, isUser, managedAgencies, userAgencies, selectedAgency]);

  return (
    <AgencyContext.Provider value={{ selectedAgency, setSelectedAgency, managedAgencyIds, userAgencyIds }}>
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
