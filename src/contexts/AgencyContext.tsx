import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { useUserRole } from "@/hooks/useUserRole";
import { useManagedAgencies } from "@/hooks/useManagedAgencies";

interface AgencyContextType {
  selectedAgency: string;
  setSelectedAgency: (agencyId: string) => void;
  managedAgencyIds: string[];
}

const AgencyContext = createContext<AgencyContextType | undefined>(undefined);

export function AgencyProvider({ children }: { children: ReactNode }) {
  const [selectedAgency, setSelectedAgency] = useState<string>("all");
  const { isAgencyManager } = useUserRole();
  const { managedAgencies } = useManagedAgencies();

  const managedAgencyIds = managedAgencies?.map(a => a.id) || [];

  // For agency managers, set the first managed agency as default
  useEffect(() => {
    if (isAgencyManager && managedAgencies && managedAgencies.length > 0) {
      setSelectedAgency(managedAgencies[0].id);
    }
  }, [isAgencyManager, managedAgencies]);

  return (
    <AgencyContext.Provider value={{ selectedAgency, setSelectedAgency, managedAgencyIds }}>
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
