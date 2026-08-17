import { createContext, useContext, useState, ReactNode, useEffect, useRef, useCallback } from "react";
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

const LEGACY_STORAGE_KEY = "selectedAgencyId";

function storageKey(tenantId: string): string {
  return `selectedAgencyId:${tenantId}`;
}

function readStoredAgency(tenantId: string | null): string {
  if (!tenantId) return "all";
  try {
    const scoped = localStorage.getItem(storageKey(tenantId));
    if (scoped && scoped.length > 0) return scoped;
    // One-time migration from the old global key.
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy && legacy.length > 0) return legacy;
  } catch {
    // ignore storage failures (private mode, etc.)
  }
  return "all";
}

function writeStoredAgency(tenantId: string | null, agencyId: string) {
  if (!tenantId) return;
  try {
    localStorage.setItem(storageKey(tenantId), agencyId);
  } catch {
    // ignore
  }
}

export function AgencyProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { currentTenantId, isActiveTenantSynced } = useTenant();
  const prevTenantIdRef = useRef<string | null>(null);
  const hydratedTenantRef = useRef<string | null>(null);

  const [selectedAgency, setSelectedAgencyState] = useState<string>("all");

  const setSelectedAgency = useCallback((agencyId: string) => {
    setSelectedAgencyState(agencyId);
    writeStoredAgency(currentTenantId, agencyId);
  }, [currentTenantId]);

  // Hydrate per-tenant selection when the active tenant changes (not on every remount).
  useEffect(() => {
    if (!currentTenantId) return;
    if (hydratedTenantRef.current === currentTenantId) return;
    hydratedTenantRef.current = currentTenantId;
    setSelectedAgencyState(readStoredAgency(currentTenantId));
    if (prevTenantIdRef.current && prevTenantIdRef.current !== currentTenantId) {
      queryClient.invalidateQueries({ queryKey: ["agencies-filter", currentTenantId] });
    }
    prevTenantIdRef.current = currentTenantId;
  }, [currentTenantId, queryClient]);

  // Get all agencies for the filter - ONLY when tenant is synced
  const {
    data: allAgencies,
    isLoading: isLoadingAgencies,
    isFetching: isFetchingAgencies,
    isFetched: isAgenciesFetched,
  } = useQuery({
    queryKey: ["agencies-filter", currentTenantId],
    queryFn: async () => {
      if (!currentTenantId) return [] as any[];

      const [
        { data: ownedAgencies, error: ownedError },
        { data: sharedAccess, error: sharedError },
      ] = await Promise.all([
        supabase.from("agencies").select("id, name").eq("tenant_id", currentTenantId).order("name"),
        supabase.from("agency_tenant_access").select("agency_id, agencies(id, name)").eq("accessing_tenant_id", currentTenantId),
      ]);

      if (ownedError) {
        console.error("Error fetching owned agencies:", ownedError);
        return [];
      }
      if (sharedError) {
        console.error("Error fetching shared agencies:", sharedError);
      }

      const shared = sharedAccess?.map((s) => s.agencies).filter(Boolean) || [];
      const combined = [...(ownedAgencies || []), ...shared];

      const uniqueMap = new Map<string, { id: string; name: string }>();
      combined.forEach((agency) => {
        if (agency && agency.id) {
          uniqueMap.set(agency.id, agency);
        }
      });

      return Array.from(uniqueMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    },
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
    enabled: !!currentTenantId && isActiveTenantSynced,
  });

  const agencies = allAgencies;
  const isLoading = isLoadingAgencies;

  // Ensure a valid selection once agencies are fully loaded for this tenant.
  useEffect(() => {
    if (!agencies || agencies.length === 0) return;
    if (!isAgenciesFetched || isLoadingAgencies || isFetchingAgencies) return;

    if (agencies.length === 1) {
      if (selectedAgency !== agencies[0].id) {
        setSelectedAgency(agencies[0].id);
      }
      return;
    }

    const exists = selectedAgency === "all" || agencies.some((a) => a.id === selectedAgency);
    if (!exists) {
      setSelectedAgency("all");
    }
  }, [agencies, selectedAgency, isLoadingAgencies, isFetchingAgencies, isAgenciesFetched, setSelectedAgency]);

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
