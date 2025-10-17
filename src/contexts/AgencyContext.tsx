import { createContext, useContext, useState, ReactNode } from "react";

interface AgencyContextType {
  selectedAgency: string;
  setSelectedAgency: (agencyId: string) => void;
}

const AgencyContext = createContext<AgencyContextType | undefined>(undefined);

export function AgencyProvider({ children }: { children: ReactNode }) {
  const [selectedAgency, setSelectedAgency] = useState<string>("all");

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
