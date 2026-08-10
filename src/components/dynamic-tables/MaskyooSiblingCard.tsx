import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MaskyooCallsCard } from "./MaskyooCallsCard";
import { useSeoScope } from "@/hooks/useSeoScope";

interface MaskyooNumberRow {
  display_number: string;
  category: "organic" | "paid" | "general" | string | null;
  is_ignored: boolean;
}

/**
 * Renders the SEO calls KPI card for the report's client.
 * Always shown when a client is linked (manual edit works even without
 * any Maskyoo number assigned).
 */
export function MaskyooSiblingCard({
  clientId,
  fallbackTenantId,
}: {
  clientId: string;
  fallbackTenantId?: string;
}) {
  const { data: seoScope, isLoading: scopeLoading } = useSeoScope(clientId);

  const accessibleTenantIds =
    seoScope?.accessibleTenantIds?.length
      ? seoScope.accessibleTenantIds
      : fallbackTenantId
        ? [fallbackTenantId]
        : [];

  const storageTenantId =
    seoScope?.clientTenantId || fallbackTenantId || accessibleTenantIds[0] || "";

  const { data: rows, isLoading: numbersLoading } = useQuery({
    queryKey: ["maskyoo-numbers-by-client", clientId, accessibleTenantIds],
    enabled: !!clientId && accessibleTenantIds.length > 0,
    staleTime: 60_000,
    queryFn: async (): Promise<MaskyooNumberRow[]> => {
      const { data, error } = await supabase
        .from("maskyoo_numbers")
        .select("display_number, category, is_ignored")
        .in("tenant_id", accessibleTenantIds)
        .eq("client_id", clientId)
        .eq("is_ignored", false);
      if (error) throw error;
      return (data || []) as MaskyooNumberRow[];
    },
  });

  if (!clientId || !storageTenantId) return null;

  const numbers = (rows || []).map((r) => {
    const cat = (r.category || "organic").toLowerCase();
    const category: "organic" | "paid" = cat === "paid" ? "paid" : "organic";
    return { number: r.display_number, category };
  });

  return (
    <MaskyooCallsCard
      clientId={clientId}
      storageTenantId={storageTenantId}
      accessibleTenantIds={accessibleTenantIds}
      numbers={numbers}
      isLoading={scopeLoading || numbersLoading}
    />
  );
}
